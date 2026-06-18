import { callGroq } from "./groqClient.js";
import { generateImage } from "./geminiClient.js";
import { prisma } from "./prisma.js";

const AGENT_NAMES = ["summarizer", "imagegen"] as const;
type AgentName = typeof AGENT_NAMES[number];

export function extractMentions(content: string): AgentName[] {
  const found: AgentName[] = [];
  for (const name of AGENT_NAMES) {
    if (content.toLowerCase().includes(`@${name}`)) found.push(name);
  }
  return found;
}

export async function runAgent(agentName: AgentName, groupChatId: string, prompt: string) {
  const agent = await prisma.agent.findUnique({ where: { name: agentName } });
  if (!agent) throw new Error(`Agent ${agentName} not found in DB`);

  if (agentName === "summarizer") {
    const recentMessages = await prisma.groupMessage.findMany({
      where: { groupChatId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: true, agent: true },
    });

    const transcript = recentMessages
      .reverse()
      .map((m) => `${m.user?.name || m.agent?.name || "unknown"}: ${m.content}`)
      .join("\n");

    const summary = await callGroq([
      { role: "system", content: "Summarize this group chat conversation concisely." },
      { role: "user", content: transcript },
    ]);

    return { content: summary, agentId: agent.id };
  }

  if (agentName === "imagegen") {
    const cleanPrompt = prompt.replace(/@imagegen/gi, "").trim();
    const imageDataUrl = await generateImage(cleanPrompt);

    return {
      content: `Generated image for: "${cleanPrompt}"`,
      agentId: agent.id,
      sources: { image: imageDataUrl },
    };
  }

  throw new Error(`Unhandled agent: ${agentName}`);
}