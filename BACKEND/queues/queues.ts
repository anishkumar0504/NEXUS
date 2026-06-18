import { Queue } from "bullmq";
import { createBullConnection } from "../redis/redis.js";

export interface MessageJobData {
  groupId: string;
  content: string;
  senderType: "USER" | "AGENT";
  userId?: string;
  agentId?: string;
  /** client-generated id so the frontend can reconcile optimistic UI */
  tempId: string;
}

export interface AgentJobData {
  groupId: string;
  agentName: string;
  prompt: string;
  triggeringUserId: string;
  tempId: string;
}

/** Every chat message (user or agent) flows through this queue. */
export const messageQueue = new Queue<MessageJobData>("message-pipeline", {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

/** Agent invocations get their own queue so a slow @imagegen call never
 *  blocks the user's own message from being cached/broadcast/saved. */
export const agentQueue = new Queue<AgentJobData>("agent-dispatch", {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 1, // failures are handled explicitly in the worker, no blind retry
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});