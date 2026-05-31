import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { tavily } from "@tavily/core";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT, FOLLOWUP_PROMPT_TEMPLATE } from "./prompt.js";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "./lib/prisma.js";
import { middleware } from "./middleware.js";

const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// How long to keep cached search results (in milliseconds)
// 1 hour = 60 * 60 * 1000
const CACHE_TTL_MS = 60 * 60 * 1000;
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
// ─────────────────────────────────────────────
// Helper: get search results, using DB cache
// ─────────────────────────────────────────────
async function getSearchResults(query: string) {
  const now = new Date();

  // Check if we have a fresh cache entry for this exact query
  const cached = await prisma.searchCache.findUnique({
    where: { query },
  });

  if (cached && cached.expiresAt > now) {
    console.log("Cache hit for query:", query);
    return cached.results as any[];
  }

  // No cache or expired — hit Tavily
  console.log("Cache miss, calling Tavily for:", query);
  const webSearchResponse = await tavilyClient.search(query, {
    searchDepth: "advanced",
  });
  const results = webSearchResponse.results;

  // Save/update cache
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
  await prisma.searchCache.upsert({
    where: { query },
    create: { query, results, expiresAt },
    update: { results, expiresAt },
  });

  return results;
}

// ─────────────────────────────────────────────
// GET /conversations
// Returns all conversations for the logged-in user
// ─────────────────────────────────────────────
app.get("/conversations", middleware, async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1, // just the first message as a preview
        },
      },
    });

    res.json({ conversations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// ─────────────────────────────────────────────
// GET /conversation/:conversationId
// Returns a single full conversation with all messages
// ─────────────────────────────────────────────
app.get("/conversation/:conversationId", middleware, async (req, res) => {
  try {
const conversationId = req.params.conversationId as string;
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Make sure user owns this conversation
    if (conversation.userId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json({ conversation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// ─────────────────────────────────────────────
// POST /ask
// Main search endpoint — streams AI answer + sources
// Creates a new conversation and saves messages
// ─────────────────────────────────────────────
app.post("/ask", middleware, async (req, res) => {
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
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
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

    // ✅ Save to DB BEFORE res.end() so we can send the ID back
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
              sources: sources,
            },
          ],
        },
      },
    });

    // ✅ Send conversation ID so frontend can use it for follow-ups
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
// Follow-up question on an existing conversation
// Streams answer using full conversation history as context
// ─────────────────────────────────────────────
app.post("/ask/followup", middleware, async (req, res) => {
  try {
    const { conversationId, query } = req.body;

    if (!conversationId || !query) {
      return res.status(400).json({ error: "conversationId and query are required" });
    }

    // Step 1: Load the existing conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (conversation.userId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Step 2: Get fresh search results for the follow-up query
    const webSearchResults = await getSearchResults(query.trim());

    // Step 3: Build conversation history string to give LLM context
    const historyText = conversation.messages
.map((m: any) => `${m.role === "USER" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    // Step 4: Build prompt with history + new query
    const prompt = FOLLOWUP_PROMPT_TEMPLATE
      .replace("{CONVERSATION_HISTORY}", historyText)
      .replace("{WEB_SEARCH_RESULTS}", JSON.stringify(webSearchResults))
      .replace("{USER_QUERY}", query);

    // Step 5: Stream the response
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
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

    // Step 6: Save new messages to existing conversation
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
          sources: sources,
          conversationId,
        },
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

// ─────────────────────────────────────────────
// DELETE /conversation/:conversationId
// Delete a conversation (and its messages via cascade)
// ─────────────────────────────────────────────
app.delete("/conversation/:conversationId", middleware, async (req, res) => {
  try {
const conversationId = req.params.conversationId as string;
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (conversation.userId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Delete messages first, then conversation
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversation.delete({ where: { id: conversationId } });

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});
export { app };
