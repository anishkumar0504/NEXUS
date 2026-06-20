import { callGroq } from "./groqClient.js";
import { generateImage } from "./geminiClient.js";
import { prisma } from "./prisma.js";

const AGENT_NAMES = ["summarizer", "imagegen", "nexus"] as const;
type AgentName = typeof AGENT_NAMES[number];

export function extractMentions(content: string): AgentName[] {
  const found: AgentName[] = [];
  for (const name of AGENT_NAMES) {
    if (content.toLowerCase().includes(`@${name}`)) found.push(name);
  }
  return found;
}

async function getChatHistory(groupChatId: string, take: number = 50) {
  const messages = await prisma.groupMessage.findMany({
    where: { groupChatId },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: true, agent: true },
  });
  return messages.reverse();
}

function buildTranscript(messages: any[]) {
  return messages
    .map((m) => {
      const sender = m.user?.name || m.agent?.name || "unknown";
      return `${sender}: ${m.content}`;
    })
    .join("\n");
}

export async function runAgent(agentName: AgentName, groupChatId: string, prompt: string) {
  const agent = await prisma.agent.findUnique({ where: { name: agentName } });
  if (!agent) throw new Error(`Agent ${agentName} not found in DB`);

  // ── @summarizer ─────────────────────────────────────────────
  if (agentName === "summarizer") {
    const messages = await getChatHistory(groupChatId, 20);
    const transcript = buildTranscript(messages);

    const summary = await callGroq([
      { role: "system", content: "Summarize this group chat conversation concisely. Focus on key points, decisions, and who said what." },
      { role: "user", content: transcript },
    ]);

    return { content: summary, agentId: agent.id };
  }

  // ── @imagegen ───────────────────────────────────────────────
  if (agentName === "imagegen") {
    const cleanPrompt = prompt.replace(/@imagegen/gi, "").trim();
    const imageDataUrl = await generateImage(cleanPrompt);
    return {
      content: `Generated image for: "${cleanPrompt}"`,
      agentId: agent.id,
      sources: { image: imageDataUrl },
    };
  }

  // ── @nexus ──────────────────────────────────────────────────
  if (agentName === "nexus") {
    const cleanPrompt = prompt.replace(/@nexus/gi, "").trim();
    const lowerPrompt = cleanPrompt.toLowerCase();

    // Check if this needs chat history context
    const needsHistory = 
      lowerPrompt.includes("who said") ||
      lowerPrompt.includes("what did") ||
      lowerPrompt.includes("summar") ||
      lowerPrompt.includes("recap") ||
      lowerPrompt.includes("conversation") ||
      lowerPrompt.includes("chat") ||
      lowerPrompt.includes("we talked") ||
      lowerPrompt.includes("earlier") ||
      lowerPrompt.includes("anyone say");

    let finalPrompt: string;

    if (needsHistory) {
      const messages = await getChatHistory(groupChatId, 50);
      const transcript = buildTranscript(messages);

      // Check if user explicitly wants a summary
      const wantsSummary = 
        lowerPrompt.includes("summar") ||
        lowerPrompt.includes("recap") ||
        lowerPrompt.includes("what happened");

      let context = "";
      if (wantsSummary) {
        const summaryResult = await runAgent("summarizer", groupChatId, prompt);
        context = `CONVERSATION SUMMARY:\n${summaryResult.content}\n\n`;
      }

      finalPrompt = `${context}CHAT HISTORY:\n${transcript}\n\nUSER QUESTION: ${cleanPrompt}`;
    } else {
      // General knowledge question — no history needed
      finalPrompt = cleanPrompt;
    }

    const response = await callGroq([
      {
        role: "system",
        content: `You are Nexus, a helpful AI assistant in a group chat. You can:
- Answer general knowledge questions
- Search chat history and tell users who said what
- Summarize conversations when asked
- Be concise, accurate, and friendly`,
      },
      { role: "user", content: finalPrompt },
    ]);

    return { content: response, agentId: agent.id };
  }

  throw new Error(`Unhandled agent: ${agentName}`);
}