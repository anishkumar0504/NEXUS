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

// ── Per-user plan tracking ───────────────────────────────────
interface ActivePlan {
  userId: string;
  prompt: string;
  timestamp: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

const activePlans = new Map<string, ActivePlan>();

function setPlan(groupChatId: string, userId: string, prompt: string) {
  // Clear existing plan for this group if any
  const existing = activePlans.get(groupChatId);
  if (existing) clearTimeout(existing.timeoutId);

  const timeoutId = setTimeout(() => {
    activePlans.delete(groupChatId);
  }, 2 * 60 * 1000); // 2 minutes auto-expire

  activePlans.set(groupChatId, { userId, prompt, timestamp: Date.now(), timeoutId });
}

function clearPlan(groupChatId: string) {
  const existing = activePlans.get(groupChatId);
  if (existing) {
    clearTimeout(existing.timeoutId);
    activePlans.delete(groupChatId);
  }
}

function getPlan(groupChatId: string): ActivePlan | undefined {
  return activePlans.get(groupChatId);
}

export async function runAgent(
  agentName: AgentName,
  groupChatId: string,
  prompt: string,
  triggeringUserId?: string
) {
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

    const plan = getPlan(groupChatId);
    const userId = triggeringUserId || "";

    // Check if this is a follow-up to an active plan (and it's the SAME user)
    const isFollowUp =
      plan !== undefined &&
      plan.userId === userId &&
      (lowerPrompt.includes("i choose") ||
        lowerPrompt.includes("proceed") ||
        lowerPrompt.includes("skip") ||
        lowerPrompt.includes("something else"));

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

    // Check if this is a complex task that needs clarification
    const isComplex =
      !isFollowUp &&
      (lowerPrompt.includes("plan") ||
        lowerPrompt.includes("strategy") ||
        lowerPrompt.includes("approach") ||
        lowerPrompt.includes("how should we") ||
        lowerPrompt.includes("best way to") ||
        lowerPrompt.includes("complex") ||
        lowerPrompt.includes("detailed") ||
        lowerPrompt.includes("research") ||
        lowerPrompt.includes("analyze") ||
        cleanPrompt.length > 100);

    let finalPrompt: string;

    if (needsHistory) {
      const messages = await getChatHistory(groupChatId, 50);
      const transcript = buildTranscript(messages);

      let context = "";
      if (
        lowerPrompt.includes("summar") ||
        lowerPrompt.includes("recap") ||
        lowerPrompt.includes("what happened")
      ) {
        const summaryResult = await runAgent("summarizer", groupChatId, prompt);
        context = `CONVERSATION SUMMARY:\n${summaryResult.content}\n\n`;
      }

      finalPrompt = `${context}CHAT HISTORY:\n${transcript}\n\nUSER QUESTION: ${cleanPrompt}`;
    } else {
      finalPrompt = cleanPrompt;
    }

    // If complex task AND not a follow-up → ask clarifying questions
    if (isComplex) {
      setPlan(groupChatId, userId, cleanPrompt);

      const planResponse = await callGroq([
        {
          role: "system",
          content: `You are Nexus, a helpful AI assistant. The user has asked a complex task.
Before proceeding, ask 1 clarifying question to understand what they need.
Format your response EXACTLY like this:

I'm planning how to help you with this.

Here's my approach:
[brief 1-2 sentence description of what you'll do]

What would you prefer?
○ [Option 1: 5-8 words]
○ [Option 2: 5-8 words]
○ [Option 3: 5-8 words]
○ Something else (write your own)

Use the ○ symbol exactly as shown. Keep it concise.`,
        },
        { role: "user", content: cleanPrompt },
      ]);

      return { content: planResponse, agentId: agent.id };
    }

    // If follow-up to plan → clear plan and proceed with full answer
    if (isFollowUp) {
      clearPlan(groupChatId);

      let choiceContext = "";
      if (lowerPrompt.includes("something else")) {
        const custom = cleanPrompt.replace(/something else:?/i, "").trim();
        choiceContext = `The user wants something else: "${custom || "their own approach"}"`;
      } else if (lowerPrompt.includes("i choose")) {
        const choice = cleanPrompt.replace(/i choose:?/i, "").trim();
        choiceContext = `The user chose: "${choice}"`;
      } else {
        choiceContext = "The user wants to proceed with the default plan.";
      }

      finalPrompt = `${choiceContext}\n\nOriginal request: ${plan?.prompt || cleanPrompt}`;
    }

    // Normal response (general knowledge or follow-up to plan)
    const response = await callGroq([
      {
        role: "system",
        content: `You are Nexus, a helpful AI assistant in a group chat. You can:
- Answer general knowledge questions
- Search chat history and tell users who said what
- Summarize conversations when asked
- Be concise, accurate, and friendly
${isFollowUp ? "The user has responded to your plan. Proceed with the full detailed answer based on their choice." : ""}`,
      },
      { role: "user", content: finalPrompt },
    ]);

    return { content: response, agentId: agent.id };
  }

  throw new Error(`Unhandled agent: ${agentName}`);
}