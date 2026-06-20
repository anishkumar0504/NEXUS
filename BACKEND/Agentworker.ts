import { Worker } from "bullmq";
import { createBullConnection } from "./redis/redis.js";
import { runMessagePipeline } from "./messagePipeline.js";
import { AgentJobData } from "./queues/queues.js";
import { runAgent } from "./lib/agentDispatcher.js";
import { prisma } from "./lib/prisma.js";

export const agentWorker = new Worker<AgentJobData>(
  "agent-dispatch",
  async (job) => {
    const { groupId, agentName, prompt, tempId, triggeringUserId } = job.data;

    let content: string;
    let agentId: string | undefined;

    try {
      const result = await runAgent(agentName, groupId, prompt, triggeringUserId);
      content = result.content;
      agentId = result.agentId;
    } catch (err: any) {
      console.error(`[agentWorker] agent ${agentName} failed:`, err.message);
      content = `Agent @${agentName} failed: ${err.message}`;
      const agent = await prisma.agent.findUnique({ where: { name: agentName } });
      agentId = agent?.id;
    }

    return runMessagePipeline({
      tempId,
      groupId,
      content,
      senderType: "AGENT",
      agentId,
        triggeringUserId, // ← ADD THIS

      createdAt: new Date().toISOString(),
    });
  },
  { connection: createBullConnection(), concurrency: 5 }
);

agentWorker.on("failed", (job, err) => {
  console.error(`[agentWorker] job ${job?.id} failed:`, err.message);
});