import { Worker } from "bullmq";
import { randomUUID } from "crypto";
import { createBullConnection } from "./redis/redis.js";
import { runMessagePipeline } from "./messagePipeline.js";
import { agentQueue, MessageJobData } from "./queues/queues.js";
import  {extractMentions}  from "./lib/agentDispatcher.js";

export const messageWorker = new Worker<MessageJobData>(
  "message-pipeline",
  async (job) => {
    const { groupId, content, senderType, userId, agentId, tempId } = job.data;

    const saved = await runMessagePipeline({
      tempId,
      groupId,
      content,
      senderType, 
      userId,
      agentId,
      createdAt: new Date().toISOString(),
    });

    // Only the user's own message can trigger an agent — avoids agents
    // re-triggering each other off of @mentions inside their own replies.
    if (senderType === "USER") {
      const mentions = extractMentions(content);
      for (const agentName of mentions) {
        await agentQueue.add("dispatch-agent", {
          groupId,
          agentName,
          prompt: content,
          triggeringUserId: userId!,
          tempId: randomUUID(),
        });
      }
    }

    return saved;
  },
  { connection: createBullConnection(), concurrency: 10 }
);

messageWorker.on("failed", (job, err) => {
  console.error(`[messageWorker] job ${job?.id} failed:`, err.message);
});
