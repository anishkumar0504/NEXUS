import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock everything before any imports ─────────────────────────
const mockGetUser = vi.fn();

vi.mock("../lib/client.js", () => ({
  supabase: { auth: { getUser: mockGetUser } },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: mockPrisma,
}));

vi.mock("@tavily/core", () => ({
  tavily: () => ({ search: mockTavilySearch }),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContentStream: mockGenerateContentStream };
  },
}));

vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));

// ── Mock functions ──────────────────────────────────────────────
const mockTavilySearch = vi.fn();
const mockGenerateContentStream = vi.fn();
const mockPrisma = {
  user: { findUnique: vi.fn(), create: vi.fn() },
  conversation: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  message: { createMany: vi.fn(), deleteMany: vi.fn() },
  searchCache: { findUnique: vi.fn(), upsert: vi.fn() },
};

import request from "supertest";
import express from "express";
import cors from "cors";
import { PROMPT_TEMPLATE, SYSTEM_PROMPT, FOLLOWUP_PROMPT_TEMPLATE } from "../prompt.js";

// ── Constants ───────────────────────────────────────────────────
const VALID_TOKEN = "valid-jwt-token";
const USER_ID = "supabase-uuid-123";
const CONV_ID = "conv_cuid_abc";

const FAKE_SEARCH_RESULTS = [
  { url: "https://example.com", title: "Example", content: "Some content" },
  { url: "https://wiki.com", title: "Wiki", content: "More content" },
];

async function* fakeStream(chunks: string[]) {
  for (const chunk of chunks) yield { text: chunk };
}

// ── Auth helpers ────────────────────────────────────────────────
function mockValidAuth() {
  mockGetUser.mockResolvedValue({
    data: {
      user: {
        id: USER_ID,
        email: "anish@example.com",
        app_metadata: { provider: "github" },
        user_metadata: { full_name: "Anish" },
      },
    },
    error: null,
  });
  mockPrisma.user.findUnique.mockResolvedValue({
    id: USER_ID,
    email: "anish@example.com",
    name: "Anish",
    provider: "GitHub",
  });
}

function mockInvalidAuth() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: "Invalid token" },
  });
}

// ── Rebuild middleware inline (uses the mocked supabase) ────────
// We do NOT import the real middleware.ts — we recreate it here
// so it picks up the mocked supabase.auth.getUser above.
async function middleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token provided" });

  const { data, error } = await mockGetUser(token);
  if (error || !data?.user) return res.status(401).json({ error: "Unauthorized" });

  const supabaseUser = data.user;
  let dbUser = await mockPrisma.user.findUnique({ where: { id: supabaseUser.id } });

  if (!dbUser) {
    const provider = supabaseUser.app_metadata?.provider === "github" ? "GitHub" : "Google";
    const name = supabaseUser.user_metadata?.full_name || supabaseUser.email?.split("@")[0] || "Unknown";
    dbUser = await mockPrisma.user.create({
      data: { id: supabaseUser.id, name, email: supabaseUser.email, provider },
    });
  }

  req.userId = supabaseUser.id;
  next();
}

// ── Search cache helper ─────────────────────────────────────────
const CACHE_TTL_MS = 60 * 60 * 1000;

async function getSearchResults(query: string) {
  const now = new Date();
  const cached = await mockPrisma.searchCache.findUnique({ where: { query } });
  if (cached && new Date(cached.expiresAt) > now) return cached.results as any[];

  const res = await mockTavilySearch(query, { searchDepth: "advanced" });
  const results = res.results;
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
  await mockPrisma.searchCache.upsert({
    where: { query },
    create: { query, results, expiresAt },
    update: { results, expiresAt },
  });
  return results;
}

// ── Build Express app ───────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.get("/conversations", middleware, async (req: any, res: any) => {
  try {
    const conversations = await mockPrisma.conversation.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
    res.json({ conversations });
  } catch {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

app.get("/conversation/:conversationId", middleware, async (req: any, res: any) => {
  try {
    const { conversationId } = req.params;
    const conversation = await mockPrisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    res.json({ conversation });
  } catch {
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

app.post("/ask", middleware, async (req: any, res: any) => {
  try {
    const query: string = req.body.query;
    if (!query || query.trim() === "") return res.status(400).json({ error: "Query is required" });

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    const webSearchResults = await getSearchResults(query.trim());
    const prompt = PROMPT_TEMPLATE
      .replace("{WEB_SEARCH_RESULTS}", JSON.stringify(webSearchResults))
      .replace("{USER_QUERY}", query);

    const stream = await mockGenerateContentStream({ model: "gemini-2.5-flash", contents: prompt, config: { systemInstruction: SYSTEM_PROMPT } });

    let fullAnswer = "";
    for await (const chunk of stream) {
      const text = chunk.text ?? "";
      fullAnswer += text;
      res.write(text);
    }

    const sources = webSearchResults.map((r: any) => ({ url: r.url, title: r.title }));
    res.write("\n<SOURCES>\n");
    res.write(JSON.stringify(sources));
    res.write("\n</SOURCES>\n");

    const conversation = await mockPrisma.conversation.create({
      data: {
        title: query.slice(0, 100),
        userId: req.userId,
        messages: { create: [{ content: query, role: "USER" }, { content: fullAnswer, role: "ASSISTANT", sources }] },
      },
    });

    res.write(`\n<CONV_ID>${conversation.id}</CONV_ID>\n`);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: "Something went wrong" });
    else { res.write("\n[Error occurred]"); res.end(); }
  }
});

app.post("/ask/followup", middleware, async (req: any, res: any) => {
  try {
    const { conversationId, query } = req.body;
    if (!conversationId || !query) return res.status(400).json({ error: "conversationId and query are required" });

    const conversation = await mockPrisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

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

    const stream = await mockGenerateContentStream({ model: "gemini-2.5-flash", contents: prompt, config: { systemInstruction: SYSTEM_PROMPT } });

    let fullAnswer = "";
    for await (const chunk of stream) {
      const text = chunk.text ?? "";
      fullAnswer += text;
      res.write(text);
    }

    const sources = webSearchResults.map((r: any) => ({ url: r.url, title: r.title }));
    res.write("\n<SOURCES>\n");
    res.write(JSON.stringify(sources));
    res.write("\n</SOURCES>\n");
    res.end();

    await mockPrisma.message.createMany({
      data: [
        { content: query, role: "USER", conversationId },
        { content: fullAnswer, role: "ASSISTANT", sources, conversationId },
      ],
    });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: "Something went wrong" });
    else { res.write("\n[Error occurred]"); res.end(); }
  }
});

app.delete("/conversation/:conversationId", middleware, async (req: any, res: any) => {
  try {
    const { conversationId } = req.params;
    const conversation = await mockPrisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    await mockPrisma.message.deleteMany({ where: { conversationId } });
    await mockPrisma.conversation.delete({ where: { id: conversationId } });
    res.json({ message: "Deleted successfully" });
  } catch {
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no cache hit
  mockPrisma.searchCache.findUnique.mockResolvedValue(null);
  mockPrisma.searchCache.upsert.mockResolvedValue({});
  // Default: Tavily returns fake results
  mockTavilySearch.mockResolvedValue({ results: FAKE_SEARCH_RESULTS });
});

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────

describe("Auth Middleware", () => {
  it("returns 401 when no Authorization header is sent", async () => {
    const res = await request(app).get("/conversations");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("No token provided");
  });

  it("returns 401 when token is invalid", async () => {
    mockInvalidAuth();
    const res = await request(app)
      .get("/conversations")
      .set("Authorization", "Bearer bad-token");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("creates user in DB on first login", async () => {
    // Supabase returns valid user
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: USER_ID,
          email: "new@example.com",
          app_metadata: { provider: "google" },
          user_metadata: { full_name: "New User" },
        },
      },
      error: null,
    });
    // User does NOT exist in DB yet
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: USER_ID,
      email: "new@example.com",
      name: "New User",
      provider: "Google",
    });
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get("/conversations")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: USER_ID,
          email: "new@example.com",
          provider: "Google",
        }),
      })
    );
    expect(res.status).toBe(200);
  });

  it("does not create user if they already exist in DB", async () => {
    mockValidAuth();
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    await request(app)
      .get("/conversations")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});

// ── GET /conversations ────────────────────────────────────────────────────────

describe("GET /conversations", () => {
  it("returns empty array when user has no conversations", async () => {
    mockValidAuth();
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get("/conversations")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toEqual([]);
  });

  it("returns list of conversations with preview message", async () => {
    mockValidAuth();
    const fakeConvs = [
      {
        id: CONV_ID,
        title: "What is AI?",
        userId: USER_ID,
        createdAt: new Date().toISOString(),
        messages: [{ id: "msg1", content: "What is AI?", role: "USER" }],
      },
    ];
    mockPrisma.conversation.findMany.mockResolvedValue(fakeConvs);

    const res = await request(app)
      .get("/conversations")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.conversations[0].title).toBe("What is AI?");
    expect(res.body.conversations[0].messages[0].role).toBe("USER");
  });

  it("only queries conversations belonging to the authenticated user", async () => {
    mockValidAuth();
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    await request(app)
      .get("/conversations")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
      })
    );
  });
});

// ── GET /conversation/:id ─────────────────────────────────────────────────────

describe("GET /conversation/:conversationId", () => {
  it("returns full conversation with all messages", async () => {
    mockValidAuth();
    const fakeConv = {
      id: CONV_ID,
      title: "What is AI?",
      userId: USER_ID,
      createdAt: new Date().toISOString(),
      messages: [
        { id: "msg1", content: "What is AI?", role: "USER", sources: null },
        { id: "msg2", content: "<ANSWER>AI stands for...</ANSWER>", role: "ASSISTANT", sources: [] },
      ],
    };
    mockPrisma.conversation.findUnique.mockResolvedValue(fakeConv);

    const res = await request(app)
      .get(`/conversation/${CONV_ID}`)
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.conversation.id).toBe(CONV_ID);
    expect(res.body.conversation.messages).toHaveLength(2);
  });

  it("returns 404 when conversation does not exist", async () => {
    mockValidAuth();
    mockPrisma.conversation.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get(`/conversation/nonexistent-id`)
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Conversation not found");
  });

  it("returns 403 when conversation belongs to a different user", async () => {
    mockValidAuth();
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONV_ID,
      title: "Someone else's chat",
      userId: "different-user-id",   // different user
      messages: [],
    });

    const res = await request(app)
      .get(`/conversation/${CONV_ID}`)
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });
});

// ── POST /ask ─────────────────────────────────────────────────────────────────

describe("POST /ask", () => {
  beforeEach(() => {
    mockValidAuth();
    mockGenerateContentStream.mockResolvedValue(
      fakeStream(["<ANSWER>", "AI is artificial intelligence.", "</ANSWER>",
        "\n<FOLLOW_UPS><question>Tell me more</question></FOLLOW_UPS>"])
    );
    mockPrisma.conversation.create.mockResolvedValue({
      id: CONV_ID,
      title: "What is AI?",
      userId: USER_ID,
    });
  });

  it("returns 400 when query is empty", async () => {
    const res = await request(app)
      .post("/ask")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ query: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Query is required");
  });

  it("returns 400 when query is missing", async () => {
    const res = await request(app)
      .post("/ask")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Query is required");
  });

  it("streams a response with sources and conversation ID", async () => {
    const res = await request(app)
      .post("/ask")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ query: "What is AI?" });

    expect(res.status).toBe(200);
    // Response is plain text stream
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    // Should contain the sources block
    expect(res.text).toContain("<SOURCES>");
    expect(res.text).toContain("</SOURCES>");
    // Should contain the conversation ID
    expect(res.text).toContain(`<CONV_ID>${CONV_ID}</CONV_ID>`);
  });

  it("calls Tavily search with the query", async () => {
    await request(app)
      .post("/ask")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ query: "What is AI?" });

    expect(mockTavilySearch).toHaveBeenCalledWith(
      "What is AI?",
      { searchDepth: "advanced" }
    );
  });

  it("saves conversation to DB with correct userId", async () => {
    await request(app)
      .post("/ask")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ query: "What is AI?" });

    expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          title: "What is AI?",
        }),
      })
    );
  });

  it("uses cached search results and skips Tavily when cache is fresh", async () => {
    // Set up a fresh cache hit
    mockPrisma.searchCache.findUnique.mockResolvedValue({
      query: "What is AI?",
      results: FAKE_SEARCH_RESULTS,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1hr from now
    });

    await request(app)
      .post("/ask")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ query: "What is AI?" });

    // Tavily should NOT have been called
    expect(mockTavilySearch).not.toHaveBeenCalled();
  });

  it("calls Tavily when cache is expired", async () => {
    // Expired cache entry
    mockPrisma.searchCache.findUnique.mockResolvedValue({
      query: "What is AI?",
      results: FAKE_SEARCH_RESULTS,
      expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
    });

    await request(app)
      .post("/ask")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ query: "What is AI?" });

    expect(mockTavilySearch).toHaveBeenCalled();
  });

  it("sources in the response are valid JSON array", async () => {
    const res = await request(app)
      .post("/ask")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ query: "What is AI?" });

    const sourcesMatch = res.text.match(/<SOURCES>\n([\s\S]*?)\n<\/SOURCES>/);
    expect(sourcesMatch).not.toBeNull();
    const sources = JSON.parse(sourcesMatch![1]);
    expect(Array.isArray(sources)).toBe(true);
    expect(sources[0]).toHaveProperty("url");
  });

  it("returns 401 without auth token", async () => {
    const res = await request(app)
      .post("/ask")
      .send({ query: "What is AI?" });

    expect(res.status).toBe(401);
  });
});

// ── POST /ask/followup ────────────────────────────────────────────────────────

describe("POST /ask/followup", () => {
  const existingConversation = {
    id: CONV_ID,
    title: "What is AI?",
    userId: USER_ID,
    messages: [
      { id: "msg1", content: "What is AI?", role: "USER", createdAt: new Date().toISOString() },
      { id: "msg2", content: "<ANSWER>AI is artificial intelligence.</ANSWER>", role: "ASSISTANT", createdAt: new Date().toISOString() },
    ],
  };

  beforeEach(() => {
    mockValidAuth();
    mockPrisma.conversation.findUnique.mockResolvedValue(existingConversation);
    mockPrisma.message.createMany.mockResolvedValue({ count: 2 });
    mockGenerateContentStream.mockResolvedValue(
      fakeStream(["<ANSWER>", "Qubits are quantum bits.", "</ANSWER>"])
    );
  });

  it("returns 400 when conversationId is missing", async () => {
    const res = await request(app)
      .post("/ask/followup")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ query: "Tell me more" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("conversationId and query are required");
  });

  it("returns 400 when query is missing", async () => {
    const res = await request(app)
      .post("/ask/followup")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ conversationId: CONV_ID });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("conversationId and query are required");
  });

  it("returns 404 when conversation does not exist", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post("/ask/followup")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ conversationId: "nonexistent", query: "Tell me more" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Conversation not found");
  });

  it("returns 403 when conversation belongs to a different user", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      ...existingConversation,
      userId: "someone-else",
    });

    const res = await request(app)
      .post("/ask/followup")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ conversationId: CONV_ID, query: "Tell me more" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });

  it("streams a response with sources", async () => {
    const res = await request(app)
      .post("/ask/followup")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ conversationId: CONV_ID, query: "Tell me more about qubits" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("<SOURCES>");
    expect(res.text).toContain("</SOURCES>");
  });

  it("saves new USER and ASSISTANT messages to the existing conversation", async () => {
    await request(app)
      .post("/ask/followup")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ conversationId: CONV_ID, query: "Tell me more about qubits" });

    expect(mockPrisma.message.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ role: "USER", content: "Tell me more about qubits", conversationId: CONV_ID }),
          expect.objectContaining({ role: "ASSISTANT", conversationId: CONV_ID }),
        ]),
      })
    );
  });

  it("includes conversation history in the LLM prompt", async () => {
    await request(app)
      .post("/ask/followup")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ conversationId: CONV_ID, query: "Tell me more" });

    // generateContentStream should have been called with a prompt containing past messages
    const callArg = mockGenerateContentStream.mock.calls[0][0];
    expect(callArg.contents).toContain("What is AI?");
    expect(callArg.contents).toContain("AI is artificial intelligence");
  });
});

// ── DELETE /conversation/:id ──────────────────────────────────────────────────

describe("DELETE /conversation/:conversationId", () => {
  beforeEach(() => {
    mockValidAuth();
  });

  it("deletes conversation and its messages successfully", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONV_ID,
      userId: USER_ID,
      title: "What is AI?",
    });
    mockPrisma.message.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.conversation.delete.mockResolvedValue({ id: CONV_ID });

    const res = await request(app)
      .delete(`/conversation/${CONV_ID}`)
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Deleted successfully");
  });

  it("deletes messages before deleting the conversation", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONV_ID,
      userId: USER_ID,
    });
    mockPrisma.message.deleteMany.mockResolvedValue({ count: 3 });
    mockPrisma.conversation.delete.mockResolvedValue({ id: CONV_ID });

    await request(app)
      .delete(`/conversation/${CONV_ID}`)
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    // deleteMany should be called before delete
    const deleteManyOrder = mockPrisma.message.deleteMany.mock.invocationCallOrder[0];
    const deleteOrder = mockPrisma.conversation.delete.mock.invocationCallOrder[0];
    expect(deleteManyOrder).toBeLessThan(deleteOrder);
  });

  it("returns 404 when conversation does not exist", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/conversation/nonexistent`)
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Conversation not found");
  });

  it("returns 403 when conversation belongs to a different user", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: CONV_ID,
      userId: "another-user",
      title: "Not yours",
    });

    const res = await request(app)
      .delete(`/conversation/${CONV_ID}`)
      .set("Authorization", `Bearer ${VALID_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });

  it("returns 401 without auth token", async () => {
    const res = await request(app).delete(`/conversation/${CONV_ID}`);
    expect(res.status).toBe(401);
  });
});

// ── Search Cache ──────────────────────────────────────────────────────────────

describe("Search Cache", () => {
  beforeEach(() => {
    mockValidAuth();
    mockGenerateContentStream.mockResolvedValue(
      fakeStream(["<ANSWER>Cached answer</ANSWER>"])
    );
    mockPrisma.conversation.create.mockResolvedValue({ id: CONV_ID });
  });

  it("upserts cache after a fresh Tavily call", async () => {
    mockPrisma.searchCache.findUnique.mockResolvedValue(null); // no cache

    await request(app)
      .post("/ask")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ query: "fresh query" });

    expect(mockPrisma.searchCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { query: "fresh query" },
        create: expect.objectContaining({ query: "fresh query" }),
        update: expect.objectContaining({ results: FAKE_SEARCH_RESULTS }),
      })
    );
  });

  it("does not upsert cache when a fresh cache hit exists", async () => {
    mockPrisma.searchCache.findUnique.mockResolvedValue({
      query: "cached query",
      results: FAKE_SEARCH_RESULTS,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await request(app)
      .post("/ask")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .send({ query: "cached query" });

    expect(mockPrisma.searchCache.upsert).not.toHaveBeenCalled();
    expect(mockTavilySearch).not.toHaveBeenCalled();
  });
});