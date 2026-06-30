import { callGroq } from "./groqClient.js";
import { prisma } from "./prisma.js";
import { generateImage } from "./imageClient.js";
import { runResearch } from "./researchPipeline.js";

export const AGENT_NAMES = ["summarizer", "imagegen", "nexus", "research"] as const;
export type AgentName = typeof AGENT_NAMES[number];

export function extractMentions(content: string): AgentName[] {
  const found: AgentName[] = [];
  const lower = content.toLowerCase();
  for (const name of AGENT_NAMES) {
    if (lower.includes(`@${name}`)) found.push(name);
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

// ── Per-user plan tracking (Claude-style clarification) ─────────────────────
interface ActivePlan {
  userId: string;
  prompt: string;
  timestamp: number;
  timeoutId: ReturnType<typeof setTimeout>;
  context?: string;
  questionAsked: string;
  options: string[];
}

const activePlans = new Map<string, ActivePlan>();
const PLAN_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

function setPlan(
  groupChatId: string,
  userId: string,
  prompt: string,
  questionAsked: string,
  options: string[],
  context?: string
) {
  const existing = activePlans.get(groupChatId);
  if (existing) clearTimeout(existing.timeoutId);

  const timeoutId = setTimeout(() => {
    activePlans.delete(groupChatId);
  }, PLAN_TIMEOUT_MS);

  activePlans.set(groupChatId, {
    userId,
    prompt,
    timestamp: Date.now(),
    timeoutId,
    context,
    questionAsked,
    options,
  });
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

// ── Smart complexity detection ──────────────────────────────────────────────
function isComplexTask(prompt: string): boolean {
  const lower = prompt.toLowerCase();

  // Bypass keywords — skip clarification
  if (lower.includes("quick:") || lower.includes("direct:")) return false;

  const complexityKeywords = [
    "plan", "strategy", "approach", "roadmap", "architecture",
    "design", "build", "create", "develop", "implement",
    "complex", "detailed", "comprehensive", "thorough",
    "research", "analyze", "investigate", "study",
    "compare", "evaluate", "recommend", "suggest",
    "best way", "how should", "what's the best", "how to",
    "explain in detail", "step by step", "guide me",
    "write", "generate", "draft", "prepare",
    "optimize", "improve", "refactor", "review",
    "debug", "fix", "solve", "troubleshoot",
  ];

  const isLong = prompt.length > 80;
  const hasMultipleQuestions = (prompt.match(/\?/g) || []).length > 1;
  const hasMultipleParts = /\band\b.*\?/.test(lower) || /\?.*\band\b/.test(lower);
  const isVague = ["help", "assist", "tell me about", "what do you think"].some((k) =>
    lower.includes(k)
  );

  return (
    complexityKeywords.some((k) => lower.includes(k)) ||
    isLong ||
    hasMultipleQuestions ||
    hasMultipleParts ||
    isVague
  );
}

// ── Follow-up detection ─────────────────────────────────────────────────────
function isFollowUpResponse(prompt: string, plan: ActivePlan): boolean {
  // Strip @agentname prefix for checking
  const cleanPrompt = prompt.replace(/^@\w+\s*/, "").trim();
  const lower = cleanPrompt.toLowerCase();

  // If message starts with @mention and is short, very likely a follow-up
  const startsWithMention = /^@\w+/.test(prompt);
  const isShortMention = startsWithMention && prompt.length < 120;

  const choicePatterns = [
    /i choose/i,
    /i\'ll go with/i,
    /let\'s go with/i,
    /option\s*\d/i,
    /number\s*\d/i,
    /the first/i,
    /the second/i,
    /the third/i,
    /the last/i,
    /proceed/i,
    /go ahead/i,
    /do it/i,
    /yes/i,
    /sure/i,
    /okay/i,
    /ok/i,
    /skip/i,
    /something else/i,
    /none of these/i,
    /custom/i,
    /my own/i,
  ];

  const explicitMatch = choicePatterns.some((p) => p.test(lower));

  const optionMatch = plan.options.some((opt) =>
    lower.includes(opt.toLowerCase().split(" ").slice(0, 3).join(" "))
  );

  return explicitMatch || optionMatch || isShortMention;
}

// ── Extract user's choice from follow-up ────────────────────────────────────
function extractChoice(prompt: string, plan: ActivePlan): { choice: string; isCustom: boolean } {
  // Strip @agentname prefix
  const cleanPrompt = prompt.replace(/^@\w+\s*/, "").trim();
  const lower = cleanPrompt.toLowerCase();

  if (
    lower.includes("something else") ||
    lower.includes("none of these") ||
    lower.includes("custom") ||
    lower.includes("my own") ||
    lower.includes("different")
  ) {
    const custom = cleanPrompt
      .replace(/something else:?/i, "")
      .replace(/none of these:?/i, "")
      .replace(/custom:?/i, "")
      .replace(/my own:?/i, "")
      .trim();
    return { choice: custom || "Custom approach", isCustom: true };
  }

  const numMatch = cleanPrompt.match(/option\s*(\d)|number\s*(\d)|the (first|second|third|1st|2nd|3rd)/i);
  if (numMatch) {
    const num = numMatch[1] || numMatch[2];
    if (num) {
      const idx = parseInt(num) - 1;
      if (plan.options[idx]) return { choice: plan.options[idx], isCustom: false };
    }
    const word = numMatch[3]?.toLowerCase();
    const wordMap: Record<string, number> = { first: 0, second: 1, third: 2, "1st": 0, "2nd": 1, "3rd": 2 };
    if (word && wordMap[word] !== undefined && plan.options[wordMap[word]]) {
      return { choice: plan.options[wordMap[word]], isCustom: false };
    }
  }

  const chooseMatch = cleanPrompt.match(/(?:i choose|i\'ll go with|let\'s go with|go with)\s*(.+)/i);
  if (chooseMatch) {
    const choiceText = chooseMatch[1].trim();
    const matchedOption = plan.options.find((opt) =>
      choiceText.toLowerCase().includes(opt.toLowerCase().split(" ").slice(0, 2).join(" "))
    );
    if (matchedOption) return { choice: matchedOption, isCustom: false };
    return { choice: choiceText, isCustom: true };
  }

  // Default: treat the whole cleaned prompt as the choice
  return { choice: cleanPrompt, isCustom: false };
}

// ── Main agent runner ───────────────────────────────────────────────────────
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

  // ── @research ───────────────────────────────────────────────
  if (agentName === "research") {
    const cleanPrompt = prompt.replace(/@research/gi, "").trim();
    const result = await runResearch(cleanPrompt);

    return {
      content: result.answer,
      agentId: agent.id,
      sources: {
        image: result.mindMapImageUrl,
        citations: result.sources,
        followUpQuestions: result.followUpQuestions,
        mindMapImage: result.mindMapImageUrl,
      },
    };
  }

  // ── @nexus ──────────────────────────────────────────────────
  if (agentName === "nexus") {
    const cleanPrompt = prompt.replace(/@nexus/gi, "").trim();
    const lowerPrompt = cleanPrompt.toLowerCase();
    const userId = triggeringUserId || "";

    const plan = getPlan(groupChatId);

    // Check if this is a follow-up to an active plan
    const isFollowUp =
      plan !== undefined &&
      plan.userId === userId &&
      isFollowUpResponse(prompt, plan);

    // Check if needs chat history
    const needsHistory =
      lowerPrompt.includes("who said") ||
      lowerPrompt.includes("what did") ||
      lowerPrompt.includes("summar") ||
      lowerPrompt.includes("recap") ||
      lowerPrompt.includes("conversation") ||
      lowerPrompt.includes("chat") ||
      lowerPrompt.includes("we talked") ||
      lowerPrompt.includes("earlier") ||
      lowerPrompt.includes("anyone say") ||
      lowerPrompt.includes("who mentioned");

    let context = "";
    let finalPrompt = cleanPrompt;

    if (needsHistory) {
      const messages = await getChatHistory(groupChatId, 50);
      const transcript = buildTranscript(messages);

      if (
        lowerPrompt.includes("summar") ||
        lowerPrompt.includes("recap") ||
        lowerPrompt.includes("what happened")
      ) {
        const summaryResult = await runAgent("summarizer", groupChatId, prompt);
        context = `CONVERSATION SUMMARY:\n${summaryResult.content}\n\n`;
      }

      finalPrompt = `${context}CHAT HISTORY:\n${transcript}\n\nUSER QUESTION: ${cleanPrompt}`;
    }

    // ── FOLLOW-UP: User responded to our clarifying question ──
    if (isFollowUp && plan) {
      clearPlan(groupChatId);

      const { choice, isCustom } = extractChoice(prompt, plan);

      let systemPrompt = `You are Nexus, a helpful AI assistant. The user previously asked: "${plan.prompt}"`;

      if (isCustom) {
        systemPrompt += `\n\nThey chose a custom approach: "${choice}". Proceed with a detailed, thoughtful response based on their specific direction.`;
      } else {
        systemPrompt += `\n\nThey chose: "${choice}". Proceed with a detailed, thoughtful response tailored to this choice.`;
      }

      if (plan.context) {
        systemPrompt += `\n\nAdditional context from the conversation:\n${plan.context}`;
      }

      const response = await callGroq([
        { role: "system", content: systemPrompt },
        { role: "user", content: finalPrompt },
      ]);

      return { content: response, agentId: agent.id };
    }

    // ── NEW REQUEST: Complex task → ask clarifying question ──
    if (isComplexTask(cleanPrompt) && !isFollowUp) {
      let planContext = "";
      if (needsHistory) {
        const messages = await getChatHistory(groupChatId, 30);
        planContext = buildTranscript(messages);
      }

      const planResponse = await callGroq([
        {
          role: "system",
          content: `You are Nexus, a helpful AI assistant. The user has asked a task that could benefit from clarification.

Your job: ask ONE concise clarifying question and provide 3 specific options.

Rules:
- Keep the question under 15 words
- Each option must be 4-8 words, specific and actionable
- Use the ○ symbol exactly as shown below
- Do NOT answer the question yet — just ask for clarification
- Be warm and conversational

Format EXACTLY like this:

To give you the best answer, I need a bit more context:

**${cleanPrompt}** — here's what I'm thinking:

[1-2 sentence description of your understanding of the task]

What's most important to you?

○ [Option 1: 5-8 words]
○ [Option 2: 5-8 words]
○ [Option 3: 5-8 words]
○ Something else (tell me more)

Keep it concise and friendly.`,
        },
        { role: "user", content: cleanPrompt },
      ]);

      // Extract options from response for follow-up matching
      const optionMatches = planResponse.match(/○\s*(.+?)(?=\n|$)/g) || [];
      const options = optionMatches
        .map((o) => o.replace(/○\s*/, "").trim())
        .filter((o) => o.length > 0 && !o.toLowerCase().includes("something else"));

      setPlan(groupChatId, userId, cleanPrompt, planResponse, options, planContext || undefined);

      return { content: planResponse, agentId: agent.id };
    }

    // ── SIMPLE REQUEST: Direct answer ──
    const response = await callGroq([
      {
        role: "system",
        content: `You are Nexus, a helpful AI assistant in a group chat. You can:
- Answer general knowledge questions concisely and accurately
- Search chat history and tell users who said what
- Summarize conversations when asked
- Be warm, friendly, and use markdown formatting for clarity
- If the user asks something vague, ask 1 brief follow-up question`,
      },
      { role: "user", content: finalPrompt },
    ]);

    return { content: response, agentId: agent.id };
  }

  throw new Error(`Unhandled agent: ${agentName}`);
}