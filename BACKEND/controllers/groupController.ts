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
    const [member, systemMessage] = await prisma.$transaction([
      prisma.groupMember.create({
        data: { groupChatId: groupId, userId: req.userId! },
        include: { user: true },
      }),
      prisma.groupMessage.create({
        data: {
          groupChatId: groupId,
          senderType: "SYSTEM",
          content: "joined the group",
          userId: req.userId!,
        },
        include: { user: true },
      }),
    ]);

    const io = req.app.get("io");
    // FIXED: Use group:${groupId} room to match socketBridge
    io.to(`group:${groupId}`).emit("member_joined", { member, groupId });
    io.to(`group:${groupId}`).emit("new-message", systemMessage);
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
  const { content ,tempId} = req.body;

  if (!content) return res.status(400).json({ error: "content is required" });

  const member = await prisma.groupMember.findUnique({
    where: { groupChatId_userId: { groupChatId: groupId, userId: req.userId! } },
  });
  if (!member) return res.status(403).json({ error: "Not a member of this group" });


  await messageQueue.add("ingest-message", {
    groupId,
    content,
    senderType: "USER",
    userId: req.userId!,
    tempId,
  });

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

export async function getUserGroups(req: Request, res: Response) {
  const groups = await prisma.groupChat.findMany({
    where: {
      members: {
        some: {
          userId: req.userId!,
        },
      },
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
      messages: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const sortedGroups = groups.sort((a, b) => {
    const aLastMessage = a.messages[0]?.createdAt;
    const bLastMessage = b.messages[0]?.createdAt;
    
    if (!aLastMessage && !bLastMessage) return 0;
    if (!aLastMessage) return 1;
    if (!bLastMessage) return -1;
    
    return new Date(bLastMessage).getTime() - new Date(aLastMessage).getTime();
  });

  res.status(200).json({ groups: sortedGroups });
}