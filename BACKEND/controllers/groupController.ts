import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import { messageQueue } from "../queues/queues.js";

export async function createGroup(req: Request, res: Response) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const group = await prisma.groupChat.create({
    data: {
      name,
      members: {
        create: { userId: req.userId! },
      },
    },
  });

  res.status(201).json({ group });
}

export async function joinGroup(req: Request, res: Response) {
  const { groupId } = req.params;

  const group = await prisma.groupChat.findUnique({ where: { id: groupId } });
  if (!group) return res.status(404).json({ error: "Group not found" });

  const existing = await prisma.groupMember.findUnique({
    where: { groupChatId_userId: { groupChatId: groupId, userId: req.userId! } },
  });

  if (!existing) {
    await prisma.groupMember.create({
      data: { groupChatId: groupId, userId: req.userId! },
    });
  }

  res.status(200).json({ message: "Joined group", groupId });
}

export async function getGroup(req: Request, res: Response) {
  const { groupId } = req.params;

  const member = await prisma.groupMember.findUnique({
    where: { groupChatId_userId: { groupChatId: groupId, userId: req.userId! } },
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
  const { groupId } = req.params;
  const { content } = req.body;

  if (!content) return res.status(400).json({ error: "content is required" });

  const member = await prisma.groupMember.findUnique({
    where: { groupChatId_userId: { groupChatId: groupId, userId: req.userId! } },
  });
  if (!member) return res.status(403).json({ error: "Not a member of this group" });

  const tempId = randomUUID();

  // Hands off to messageWorker, which does cache -> broadcast -> db save,
  // then fans out any @mentions to the agent queue. Nothing here touches
  // Postgres or calls an agent, so this response is fast regardless of
  // how slow @imagegen or the db are.
  await messageQueue.add("ingest-message", {
    groupId,
    content,
    senderType: "USER",
    userId: req.userId!,
    tempId,
  });

  // Client renders optimistically using tempId, then reconciles against
  // the "new-message" socket event the worker publishes a moment later.
  res.status(202).json({ status: "queued", tempId });
}

export async function getMessages(req: Request, res: Response) {
  const { groupId } = req.params;

  const member = await prisma.groupMember.findUnique({
    where: { groupChatId_userId: { groupChatId: groupId, userId: req.userId! } },
  });
  if (!member) return res.status(403).json({ error: "Not a member of this group" });

  const messages = await prisma.groupMessage.findMany({
    where: { groupChatId: groupId },
    orderBy: { createdAt: "asc" },
    include: { user: true, agent: true },
  });

  res.status(200).json({ messages });
}