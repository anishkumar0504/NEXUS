// server/messagePipeline.ts
import { prisma } from "./lib/prisma.js";
import { redisCache } from "./redis/redis.js";

const CACHE_TTL_SECONDS = 60 * 10;
const CACHE_MAX_MESSAGES = 50;
const BROADCAST_CHANNEL_PREFIX = "group-broadcast:";

export interface PipelineMessage {
  tempId: string;
  groupId: string;
  content: string;
  senderType: "USER" | "AGENT" | "SYSTEM";
  userId?: string;
  agentId?: string;
  sources?: { image?: string } | null;
  triggeringUserId?: string;
  createdAt: string;
  id?: string;
  pending?: boolean;
  user?: any;
  agent?: any;
}

function cacheKey(groupId: string) {
  return `group:${groupId}:messages`;
}

export async function cacheMessage(message: PipelineMessage) {
  const key = cacheKey(message.groupId);
  await redisCache.lpush(key, JSON.stringify(message));
  await redisCache.ltrim(key, 0, CACHE_MAX_MESSAGES - 1);
  await redisCache.expire(key, CACHE_TTL_SECONDS);
}

export async function broadcastMessage(message: PipelineMessage) {
  const channel = `${BROADCAST_CHANNEL_PREFIX}${message.groupId}`;
  await redisCache.publish(channel, JSON.stringify(message));
}

export async function persistMessage(message: PipelineMessage) {
  return prisma.groupMessage.create({
    data: {
      content: message.content,
      groupChatId: message.groupId,
      senderType: message.senderType,
      userId: message.userId,
      agentId: message.agentId,
      sources: message.sources || null,
      triggeringUserId: message.triggeringUserId || null,
    },
  });
}

export async function runMessagePipeline(message: PipelineMessage) {
  // 1. Pending
  await cacheMessage({ ...message, pending: true });
  await broadcastMessage({ ...message, pending: true });

  // 2. Persist
  const saved = await persistMessage(message);

  // 3. Fetch full record with relations for broadcast
  const fullMessage = await prisma.groupMessage.findUnique({
    where: { id: saved.id },
    include: { user: true, agent: true },
  });

  // 4. Confirmed — include user/agent so frontend can render name/avatar
  const confirmed: PipelineMessage = {
    ...message,
    id: saved.id,
    pending: false,
    user: fullMessage?.user ?? null,
    agent: fullMessage?.agent ?? null,
    triggeringUserId: message.triggeringUserId,
    sources: message.sources,
  };

  await cacheMessage(confirmed);
  await broadcastMessage(confirmed);

  return saved;
}