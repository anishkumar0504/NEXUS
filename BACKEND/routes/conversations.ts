import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { middleware } from "../middleware/middleware.js";

const router = Router();

// ─────────────────────────────────────────────
// GET /conversations
// ─────────────────────────────────────────────
router.get("/", middleware, async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1,
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
// ─────────────────────────────────────────────
router.get("/:conversationId", middleware, async (req, res) => {
  try {
    const conversationId = req.params.conversationId as string;

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

    res.json({ conversation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// ─────────────────────────────────────────────
// DELETE /conversation/:conversationId
// ─────────────────────────────────────────────
router.delete("/:conversationId", middleware, async (req, res) => {
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

    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversation.delete({ where: { id: conversationId } });

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

export default router;