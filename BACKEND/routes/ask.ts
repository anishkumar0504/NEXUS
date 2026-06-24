import { Router } from "express";
import { tavily } from "@tavily/core";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT, FOLLOWUP_PROMPT_TEMPLATE } from "../prompt/prompt.js";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "../lib/prisma.js";
import { middleware } from "../middleware/middleware.js";

const router = Router();

const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const CACHE_TTL_MS = 60 * 60 * 1000;

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

    const prompt = PROMPT_TEMPLATE
      .replace("{WEB_SEARCH_RESULTS}", JSON.stringify(webSearchResults))
      .replace("{USER_QUERY}", query);

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { systemInstruction: SYSTEM_PROMPT },
    });

    let fullAnswer = "";
    for await (const chunk of stream) {
      const text = chunk.text ?? "";
      fullAnswer += text;
      res.write(text);
    }

    const sources = webSearchResults.map((r) => ({ url: r.url, title: r.title }));
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
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Something went wrong" });
    } else {
      res.write("\n[Error occurred]");
      res.end();
    }
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

    const prompt = FOLLOWUP_PROMPT_TEMPLATE
      .replace("{CONVERSATION_HISTORY}", historyText)
      .replace("{WEB_SEARCH_RESULTS}", JSON.stringify(webSearchResults))
      .replace("{USER_QUERY}", query);

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { systemInstruction: SYSTEM_PROMPT },
    });

    let fullAnswer = "";
    for await (const chunk of stream) {
      const text = chunk.text ?? "";
      fullAnswer += text;
      res.write(text);
    }

    const sources = webSearchResults.map((r) => ({ url: r.url, title: r.title }));
    res.write("\n<SOURCES>\n");
    res.write(JSON.stringify(sources));
    res.write("\n</SOURCES>\n");
    res.end();

    await prisma.message.createMany({
      data: [
        { content: query, role: "USER", conversationId },
        { content: fullAnswer, role: "ASSISTANT", sources, conversationId },
      ],
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Something went wrong" });
    } else {
      res.write("\n[Error occurred]");
      res.end();
    }
  }
});

export default router;