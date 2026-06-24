import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import { messageQueue } from "../queues/queues.js";
import { Server as SocketIOServer } from "socket.io";

// ── Type-safe param extractor ──────────────────────────────
function getParam(req: Request, key: string): string | undefined {
  const val = req.params[key];
  return typeof val === "string" ? val : undefined;
}

// ── Auth guard ─────────────────────────────────────────────
function requireUserId(req: Request, res: Response): string | null {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return req.userId;
}

// ── Body validators ────────────────────────────────────────
function requireString(body: unknown, key: string): string | null {
  if (typeof body === "object" && body !== null) {
    const val = (body as Record<string, unknown>)[key];
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
  }
  return null;
}

function optionalString(body: unknown, key: string): string | undefined {
  if (typeof body === "object" && body !== null) {
    const val = (body as Record<string, unknown>)[key];
    if (typeof val === "string") return val;
  }
  return undefined;
}

// ── Handlers ───────────────────────────────────────────────

export async function createGroup(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const name = requireString(req.body, "name");
  if (!name) {
    return res.status(400).json({ error: "name is required and must be a non-empty string" });
  }

  const group = await prisma.groupChat.create({
    data: {
      name,
      members: {
        create: { userId },
      },
    },
  });

  res.status(201).json({ group });
}

export async function joinGroup(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const groupId = getParam(req, "groupId");
  if (!groupId) {
    return res.status(400).json({ error: "groupId is required" });
  }

  const group = await prisma.groupChat.findUnique({ where: { id: groupId } });
  if (!group) return res.status(404).json({ error: "Group not found" });

  const existing = await prisma.groupMember.findUnique({
    where: { groupChatId_userId: { groupChatId: groupId, userId } },
  });

  if (!existing) {
    const [member, systemMessage] = await prisma.$transaction([
      prisma.groupMember.create({
        data: { groupChatId: groupId, userId },
        include: { user: true },
      }),
      prisma.groupMessage.create({
        data: {
          groupChatId: groupId,
          senderType: "SYSTEM",
          content: "joined the group",
          userId,
        },
        include: { user: true },
      }),
    ]);

    const io = req.app.get("io") as SocketIOServer;
    io.to(`group:${groupId}`).emit("member_joined", { member, groupId });
    io.to(`group:${groupId}`).emit("new-message", systemMessage);
  }

  res.status(200).json({ message: "Joined group", groupId });
}

export async function getGroup(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const groupId = getParam(req, "groupId");
  if (!groupId) {
    return res.status(400).json({ error: "groupId is required" });
  }

  const member = await prisma.groupMember.findUnique({
    where: { groupChatId_userId: { groupChatId: groupId, userId } },
  });
  if (!member) return res.status(403).json({ error: "Not a member of this group" });

  const group = await prisma.groupChat.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: true } } },
  });

  if (!group) return res.status(404).json({ error: "Group not found" });
  res.status(200).json({ group });
}

export async function postMessage(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const groupId = getParam(req, "groupId");
  if (!groupId) {
    return res.status(400).json({ error: "groupId is required" });
  }

  const content = requireString(req.body, "content");
  if (!content) {
    return res.status(400).json({ error: "content is required and must be a non-empty string" });
  }

  const member = await prisma.groupMember.findUnique({
    where: { groupChatId_userId: { groupChatId: groupId, userId } },
  });
  if (!member) return res.status(403).json({ error: "Not a member of this group" });

  const tempId = optionalString(req.body, "tempId") ?? randomUUID();

  await messageQueue.add("ingest-message", {
    groupId,
    content,
    senderType: "USER",
    userId,
    tempId,
  });

  res.status(202).json({ status: "queued", tempId });
}

export async function getMessages(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const groupId = getParam(req, "groupId");
  if (!groupId) {
    return res.status(400).json({ error: "groupId is required" });
  }

  const member = await prisma.groupMember.findUnique({
    where: { groupChatId_userId: { groupChatId: groupId, userId } },
  });
  if (!member) return res.status(403).json({ error: "Not a member of this group" });

  const messages = await prisma.groupMessage.findMany({
    where: { groupChatId: groupId },
    orderBy: { createdAt: "asc" },
    include: { user: true, agent: true },
  });

  res.status(200).json({ messages });
}

export async function getUserGroups(req: Request, res: Response) {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const groups = await prisma.groupChat.findMany({
    where: {
      members: {
        some: { userId },
      },
    },
    include: {
      members: {
        include: { user: true },
      },
      _count: {
        select: { messages: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const sortedGroups = groups.sort((a, b) => {
    const aTime = a.messages[0]?.createdAt?.getTime() ?? 0;
    const bTime = b.messages[0]?.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  res.status(200).json({ groups: sortedGroups });
}