import { Worker } from "bullmq";
import { createBullConnection } from "./redis/redis.js";
import { runMessagePipeline } from "./messagePipeline.js";
import { AgentJobData } from "./queues/queues.js";
import { runAgent, AGENT_NAMES, AgentName } from "./lib/agentDispatcher.js";
import { prisma } from "./lib/prisma.js";
import { getIO } from "./server/Socketbridge.js"; // ← your getIO function
import { runResearch, ResearchCallbacks, ResearchResult } from "./lib/researchPipeline.js ";

function isValidAgentName(name: string): name is AgentName {
  return AGENT_NAMES.includes(name as AgentName);
}

export const agentWorker = new Worker<AgentJobData>(
  "agent-dispatch",
  async (job) => {
    const { groupId, agentName, prompt, tempId, triggeringUserId, socketId } = job.data;

    if (!isValidAgentName(agentName)) {
      throw new Error(`Invalid agent name: ${agentName}. Must be one of: ${AGENT_NAMES.join(", ")}`);
    }

    let content: string;
    let agentId: string | undefined;
    let sources: { image?: string } | null = null;

    try {
      // ── RESEARCH AGENT: Stream steps via Socket.IO ───────────────────
      if (agentName === "research") {
        const io = getIO(); // ← get Socket.IO instance
        
        const callbacks: ResearchCallbacks = {
          onStep: (step) => {
            const eventData = { jobId: job.id, ...step };
            if (socketId) {
              io.to(socketId).emit("research:step", eventData);
            }
            io.to(`group:${groupId}`).emit("research:step", eventData);
          },
          onComplete: (result) => {
            const eventData = { jobId: job.id, result };
            if (socketId) {
              io.to(socketId).emit("research:complete", eventData);
            }
            io.to(`group:${groupId}`).emit("research:complete", eventData);
          },
          onError: (error) => {
            const eventData = { jobId: job.id, error };
            if (socketId) {
              io.to(socketId).emit("research:error", eventData);
            }
            io.to(`group:${groupId}`).emit("research:error", eventData);
          },
        };

        const result = await runResearch(prompt, callbacks);
        content = result.answer;
        sources = result.mindMapImageUrl ? { image: result.mindMapImageUrl } : null;
        
        const agent = await prisma.agent.findUnique({ where: { name: "research" } });
        agentId = agent?.id;

      } else {
        // ── OTHER AGENTS: Original flow ────────────────────────────────
        const result = await runAgent(agentName, groupId, prompt, triggeringUserId);
        content = result.content;
        agentId = result.agentId;
        sources = result.sources || null;
      }

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
      sources,
      triggeringUserId,
      createdAt: new Date().toISOString(),
    });
  },
  { connection: createBullConnection(), concurrency: 5 }
);

agentWorker.on("failed", (job, err) => {
  console.error(`[agentWorker] job ${job?.id} failed:`, err.message);
});