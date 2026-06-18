import { prisma } from "./lib/prisma.js";
import { redisCache } from "./redis/redis.js";

const CACHE_TTL_SECONDS = 60 * 10; // 10 min — recent messages, not source of truth
const CACHE_MAX_MESSAGES = 50;
const BROADCAST_CHANNEL_PREFIX = "group-broadcast:";

export interface PipelineMessage {
  tempId: string;
  groupId: string;
  content: string;
  senderType: "USER" | "AGENT";
  userId?: string;
  agentId?: string;
  createdAt: string;
  id?: string; // present once persisted
  pending?: boolean;
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
    },
  });
}

/**
 * The discussed flow: queue -> cache -> broadcast -> db.
 * The "queue" hop already happened before this runs (it's the job that
 * triggered the worker). This function does the remaining three steps,
 * in order, then fires a second lightweight broadcast once the db write
 * confirms, swapping the optimistic tempId for the real db id.
 */
export async function runMessagePipeline(message: PipelineMessage) {
  await cacheMessage({ ...message, pending: true });
  await broadcastMessage({ ...message, pending: true });

  const saved = await persistMessage(message);

  const confirmed: PipelineMessage = {
    ...message,
    id: saved.id,
    pending: false,
  };
  await cacheMessage(confirmed);
  await broadcastMessage(confirmed);

  return saved;
}