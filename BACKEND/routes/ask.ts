import { Router, type Response } from "express";
import { tavily } from "@tavily/core";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT, FOLLOWUP_PROMPT_TEMPLATE } from "../prompt/prompt.js";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "../lib/prisma.js";
import { middleware } from "../middleware/middleware.js";

const router = Router();

const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const CACHE_TTL_MS = 60 * 60 * 1000;

const PRIMARY_MODEL = "gemini-3.8-flash";
// Optional: set GEMINI_FALLBACK_MODEL in .env to a lighter model you have access to.
// If unset, only the primary model is used (with retries).
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL;
const MODELS = FALLBACK_MODEL ? [PRIMARY_MODEL, FALLBACK_MODEL] : [PRIMARY_MODEL];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isRetryable = (e: any) => e?.status === 503 || e?.status === 429;

// ─────────────────────────────────────────────
// Helper: fill {PLACEHOLDERS} in one pass.
// Single pass + function replacer means web content / user text can never
// be re-substituted or interpreted as $& / $' patterns.
// ─────────────────────────────────────────────
function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(WEB_SEARCH_RESULTS|USER_QUERY|CONVERSATION_HISTORY)\}/g, (match, key) =>
    key in values ? values[key] : match
  );
}

// ─────────────────────────────────────────────
// Helper: get search results, using DB cache
// ─────────────────────────────────────────────
async function getSearchResults(query: string) {
  const now = new Date();

  const cached = await prisma.searchCache.findUnique({ where: { query } });

  if (cached && cached.expiresAt > now) {
    console.log("Cache hit for query:", query);
    return cached.results as any[];
  }

  console.log("Cache miss, calling Tavily for:", query);
  const webSearchResponse = await tavilyClient.search(query, {
    searchDepth: "advanced",
  });
  const results = webSearchResponse.results;

  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
  await prisma.searchCache.upsert({
    where: { query },
    create: { query, results, expiresAt },
    update: { results, expiresAt },
  });

  return results;
}

// ─────────────────────────────────────────────
// Helper: open a Gemini stream with retry + model fallback.
// Pulls the first chunk inside the retry loop so start-of-stream failures
// are retried before anything is written to the client.
// ─────────────────────────────────────────────
async function openStream(prompt: string) {
  let lastErr: any;
  for (const model of MODELS) {
    let delay = 800;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const stream = await ai.models.generateContentStream({
          model,
          contents: prompt,
          config: { systemInstruction: SYSTEM_PROMPT },
        });
        const it = stream[Symbol.asyncIterator]();
        const first = await it.next();
        return { it, first };
      } catch (e) {
        lastErr = e;
        if (!isRetryable(e)) throw e;
        console.warn(`Gemini ${model} attempt ${attempt + 1} failed (${(e as any)?.status}), retrying...`);
        await sleep(delay + Math.random() * 300);
        delay *= 2;
      }
    }
  }
  throw lastErr;
}

// Streams the answer to the client and returns the full text.
async function pipeAnswer(prompt: string, res: Response): Promise<string> {
  const { it, first } = await openStream(prompt);
  let fullAnswer = "";
  let r = first;
  while (!r.done) {
    const text = r.value.text ?? "";
    fullAnswer += text;
    res.write(text);
    r = await it.next();
  }
  return fullAnswer;
}

// ─────────────────────────────────────────────
// Helper: error handling shared by both routes
// ─────────────────────────────────────────────
function fail(res: Response, err: any) {
  console.error(err);
  if (res.writableEnded) return;

  if (!res.headersSent) {
    // Streaming headers may have been set early; clear them so the JSON error is sent normally.
    res.removeHeader("Content-Type");
    res.removeHeader("Transfer-Encoding");
    const busy = isRetryable(err);
    if (busy) res.setHeader("Retry-After", "5");
    return res
      .status(busy ? 503 : 500)
      .json({ error: busy ? "AI model is busy, try again shortly" : "Something went wrong" });
  }

  res.write("\n[Error occurred]");
  res.end();
}

// ─────────────────────────────────────────────
// POST /ask
// ─────────────────────────────────────────────
router.post("/", middleware, async (req, res) => {
  try {
    const query: string = req.body.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Query is required" });
    }

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    const webSearchResults = await getSearchResults(query.trim());

    const prompt = fillTemplate(PROMPT_TEMPLATE, {
      WEB_SEARCH_RESULTS: JSON.stringify(webSearchResults),
      USER_QUERY: query,
    });

    const fullAnswer = await pipeAnswer(prompt, res);

    const sources = webSearchResults.map((r: any) => ({ url: r.url, title: r.title }));
    res.write("\n<SOURCES>\n");
    res.write(JSON.stringify(sources));
    res.write("\n</SOURCES>\n");

    const conversation = await prisma.conversation.create({
      data: {
        title: query.slice(0, 100),
        userId: req.userId!,
        messages: {
          create: [
            { content: query, role: "USER" },
            { content: fullAnswer, role: "ASSISTANT", sources },
          ],
        },
      },
    });

    res.write(`\n<CONV_ID>${conversation.id}</CONV_ID>\n`);
    res.end();

    console.log("Saved conversation:", conversation.id);
  } catch (err) {
    fail(res, err);
  }
});

// ─────────────────────────────────────────────
// POST /ask/followup
// ─────────────────────────────────────────────
router.post("/followup", middleware, async (req, res) => {
  try {
    const { conversationId, query } = req.body;

    if (!conversationId || !query) {
      return res.status(400).json({ error: "conversationId and query are required" });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (conversation.userId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const webSearchResults = await getSearchResults(query.trim());

    const historyText = conversation.messages
      .map((m: any) => `${m.role === "USER" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const prompt = fillTemplate(FOLLOWUP_PROMPT_TEMPLATE, {
      CONVERSATION_HISTORY: historyText,
      WEB_SEARCH_RESULTS: JSON.stringify(webSearchResults),
      USER_QUERY: query,
    });

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    const fullAnswer = await pipeAnswer(prompt, res);

    const sources = webSearchResults.map((r: any) => ({ url: r.url, title: r.title }));
    res.write("\n<SOURCES>\n");
    res.write(JSON.stringify(sources));
    res.write("\n</SOURCES>\n");

    // Save BEFORE ending the response so a DB failure can still be handled.
    await prisma.message.createMany({
      data: [
        { content: query, role: "USER", conversationId },
        { content: fullAnswer, role: "ASSISTANT", sources, conversationId },
      ],
    });

    res.end();
  } catch (err) {
    fail(res, err);
  }
});

export default router;