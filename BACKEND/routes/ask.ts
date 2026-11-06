
import { Router, type Response } from "express";
import { tavily } from "@tavily/core";
import {
  PROMPT_TEMPLATE,
  SYSTEM_PROMPT,
  FOLLOWUP_PROMPT_TEMPLATE,
} from "../prompt/prompt.js";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "../lib/prisma.js";
import { middleware } from "../middleware/middleware.js";

const router = Router();

const tavilyClient = tavily({
  apiKey: process.env.TAVILY_API_KEY!,
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Primary model remains unchanged.
const PRIMARY_MODEL = "gemini-3.1-flash-lite";

// Configure only model IDs supported by your Gemini API project.
// Supports multiple comma-separated fallback models.
const FALLBACK_MODELS = [
  ...(process.env.GEMINI_FALLBACK_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean),

  // Backward compatibility with the old environment variable.
  ...(process.env.GEMINI_FALLBACK_MODEL
    ? [process.env.GEMINI_FALLBACK_MODEL.trim()]
    : []),
].filter(Boolean);

const MODELS = [
  ...new Set([PRIMARY_MODEL, ...FALLBACK_MODELS]),
];

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (error: any) =>
  [429, 500, 502, 503, 504].includes(
    Number(error?.status ?? error?.code)
  );

const isModelUnavailable = (error: any) =>
  Number(error?.status ?? error?.code) === 404;

// ─────────────────────────────────────────────
// Helper: fill placeholders in one pass.
// ─────────────────────────────────────────────

function fillTemplate(
  template: string,
  values: Record<string, string>
) {
  return template.replace(
    /\{(WEB_SEARCH_RESULTS|USER_QUERY|CONVERSATION_HISTORY)\}/g,
    (match, key) => (key in values ? values[key] : match)
  );
}

// ─────────────────────────────────────────────
// Helper: ALWAYS perform a fresh Tavily search.
// No database cache lookup or cache storage.
// ─────────────────────────────────────────────

async function getSearchResults(query: string) {
  console.log("Performing fresh Tavily search for:", query);

  const webSearchResponse = await tavilyClient.search(query, {
    searchDepth: "advanced",
  });

  return webSearchResponse.results;
}

// ─────────────────────────────────────────────
// Helper: Gemini streaming with retry + fallback.
// First chunk is fetched before returning the stream.
// This allows fallback before writing anything to the client.
// ─────────────────────────────────────────────

async function openStream(prompt: string) {
  let lastError: any;

  for (const model of MODELS) {
    let modelSucceeded = false;

    // Three total attempts per model, preserving the
    // original retry count.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(
          `[Gemini] Trying ${model}, attempt ${attempt + 1}/3`
        );

        const stream = await ai.models.generateContentStream({
          model,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_PROMPT,
          },
        });

        const it = stream[Symbol.asyncIterator]();

        // Fetch the first chunk before sending anything
        // to the frontend. If this fails, fallback is safe.
        const first = await it.next();

        console.log(`[Gemini] Connected successfully: ${model}`);

        return { it, first, model };

      } catch (error: any) {
        lastError = error;

        const status = Number(
          error?.status ?? error?.code
        );

        console.error(
          `[Gemini] ${model} attempt ${attempt + 1} failed (${status}):`,
          error.message
        );

        // Invalid model: immediately try the next model.
        if (isModelUnavailable(error)) {
          console.warn(
            `[Gemini] ${model} unavailable. Switching model.`
          );
          break;
        }

        // Non-retryable errors should not be hidden.
        if (!isRetryable(error)) {
          throw error;
        }

        // Retry the same model before falling back.
        if (attempt < 2) {
          const delay =
            Math.pow(2, attempt) * 1000 +
            Math.random() * 300;

          console.warn(
            `[Gemini] Retrying ${model} in ${Math.round(delay)}ms`
          );

          await sleep(delay);
        } else {
          console.warn(
            `[Gemini] ${model} exhausted retries. Switching model.`
          );
        }
      }
    }
  }

  throw lastError || new Error(
    "All configured Gemini models failed"
  );
}

// ─────────────────────────────────────────────
// Helper: stream answer to frontend.
// Once streaming begins, do not switch models,
// because that could duplicate partial output.
// ─────────────────────────────────────────────

async function pipeAnswer(
  prompt: string,
  res: Response
): Promise<string> {
  const { it, first, model } = await openStream(prompt);

  console.log(`[Gemini] Streaming response from ${model}`);

  let fullAnswer = "";
  let r = first;

  while (!r.done) {
    const text = r.value.text ?? "";

    fullAnswer += text;

    if (text) {
      res.write(text);
    }

    r = await it.next();
  }

  return fullAnswer;
}

// ─────────────────────────────────────────────
// Helper: shared error handling.
// ─────────────────────────────────────────────

function fail(res: Response, err: any) {
  console.error(err);

  if (res.writableEnded) return;

  if (!res.headersSent) {
    res.removeHeader("Content-Type");
    res.removeHeader("Transfer-Encoding");

    const busy = isRetryable(err);

    if (busy) {
      res.setHeader("Retry-After", "5");
    }

    return res
      .status(busy ? 503 : 500)
      .json({
        error: busy
          ? "AI model is busy, try again shortly"
          : "Something went wrong",
      });
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
      return res.status(400).json({
        error: "Query is required",
      });
    }

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    // Always fresh search.
    const webSearchResults = await getSearchResults(
      query.trim()
    );

    const prompt = fillTemplate(PROMPT_TEMPLATE, {
      WEB_SEARCH_RESULTS: JSON.stringify(webSearchResults),
      USER_QUERY: query,
    });

    const fullAnswer = await pipeAnswer(prompt, res);

    const sources = webSearchResults.map((r: any) => ({
      url: r.url,
      title: r.title,
    }));

    res.write("\n<SOURCES>\n");
    res.write(JSON.stringify(sources));
    res.write("\n</SOURCES>\n");

    // Preserve existing conversation persistence.
    const conversation = await prisma.conversation.create({
      data: {
        title: query.slice(0, 100),
        userId: req.userId!,
        messages: {
          create: [
            {
              content: query,
              role: "USER",
            },
            {
              content: fullAnswer,
              role: "ASSISTANT",
              sources,
            },
          ],
        },
      },
    });

    res.write(
      `\n<CONV_ID>${conversation.id}</CONV_ID>\n`
    );

    res.end();

    console.log(
      "Saved conversation:",
      conversation.id
    );

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
      return res.status(400).json({
        error: "conversationId and query are required",
      });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({
        error: "Conversation not found",
      });
    }

    if (conversation.userId !== req.userId) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    // Always fresh search for follow-up questions too.
    const webSearchResults = await getSearchResults(
      query.trim()
    );

    const historyText = conversation.messages
      .map(
        (m: any) =>
          `${m.role === "USER" ? "User" : "Assistant"}: ${m.content}`
      )
      .join("\n\n");

    const prompt = fillTemplate(
      FOLLOWUP_PROMPT_TEMPLATE,
      {
        CONVERSATION_HISTORY: historyText,
        WEB_SEARCH_RESULTS: JSON.stringify(webSearchResults),
        USER_QUERY: query,
      }
    );

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    const fullAnswer = await pipeAnswer(prompt, res);

    const sources = webSearchResults.map((r: any) => ({
      url: r.url,
      title: r.title,
    }));

    res.write("\n<SOURCES>\n");
    res.write(JSON.stringify(sources));
    res.write("\n</SOURCES>\n");

    // Preserve existing message persistence.
    await prisma.message.createMany({
      data: [
        {
          content: query,
          role: "USER",
          conversationId,
        },
        {
          content: fullAnswer,
          role: "ASSISTANT",
          sources,
          conversationId,
        },
      ],
    });

    res.end();

  } catch (err) {
    fail(res, err);
  }
});

export default router;
