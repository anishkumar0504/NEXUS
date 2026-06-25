import { tavily } from "@tavily/core";
import { callGroq } from "./groqClient.js";
import { generateImage } from "./imageClient.js";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

export interface ResearchResult {
  answer: string;
  sources: { title: string; url: string; content: string }[];
  mindMapImageUrl: string;
  followUpQuestions: string[];
}

export async function runResearch(query: string): Promise<ResearchResult> {
  // ── Step 1: Deep Web Search with Tavily ─────────────────────
  const searchResult = await tvly.search(query, {
    searchDepth: "advanced",
    maxResults: 8,
    includeAnswer: true,
    includeImages: false,
  });

  const rawSources = searchResult.results.map((r, i) => ({
    index: i + 1,
    title: r.title,
    url: r.url,
    content: r.content,
  }));

  // ── Step 2: Planner Agent (Groq 8B) ─────────────────────────
  // Plans the research structure
  const plan = await callGroq([
    {
      role: "system",
      content: `You are a research planner. Given a query and raw sources, create a structured research plan.
Output ONLY a JSON object with this structure:
{
  "sections": ["section1", "section2", ...],
  "keyThemes": ["theme1", "theme2", ...],
  "visualizationType": "mind_map|flowchart|timeline|comparison_table"
}`,
    },
    {
      role: "user",
      content: `Query: ${query}\n\nSources count: ${rawSources.length}\n\nTop source titles:\n${rawSources.slice(0, 3).map(s => `- ${s.title}`).join("\n")}`,
    },
  ], "llama-3.1-8b-instant");

  let researchPlan: any;
  try {
    researchPlan = JSON.parse(plan);
  } catch {
    researchPlan = {
      sections: ["Overview", "Key Findings", "Implications", "Sources"],
      keyThemes: [query],
      visualizationType: "mind_map",
    };
  }

  // ── Step 3: Context Processor Agent (Groq 8B) ───────────────
  // Extracts and organizes key information from each source
  const contexts = await Promise.all(
    rawSources.map(async (source) => {
      const extracted = await callGroq([
        {
          role: "system",
          content: "Extract 3-5 key facts from this source. Be concise and factual. Output as bullet points.",
        },
        {
          role: "user",
          content: `Title: ${source.title}\nContent: ${source.content}`,
        },
      ], "llama-3.1-8b-instant");
      return { ...source, extracted };
    })
  );

  // ── Step 4: Synthesizer Agent (Groq 70B) ────────────────────
  // Creates the final comprehensive answer
  const fullContext = contexts
    .map((c) => `[${c.index}] ${c.title}\nKey facts:\n${c.extracted}\nURL: ${c.url}`)
    .join("\n\n---\n\n");

  const synthesis = await callGroq([
    {
      role: "system",
      content: `You are a research synthesizer. Create a comprehensive, well-structured research report.
Follow this structure:
1. **Executive Summary** (2-3 sentences)
2. ${researchPlan.sections.map((s: string) => `**${s}**`).join("\n2. ")}
3. **Sources** (numbered list with URLs)

Use citations [1], [2], etc. matching the provided sources.
Be thorough but concise. Highlight key insights with bold text.`,
    },
    {
      role: "user",
      content: `Research Query: ${query}\n\nSources and Extracted Facts:\n${fullContext}`,
    },
  ], "llama-3.3-70b-versatile");

  // ── Step 5: Follow-up Question Generator (Groq 8B) ──────────
  const followUpRaw = await callGroq([
    {
      role: "system",
      content: "Based on this research, suggest 3 follow-up questions the user might want to explore. Output as a JSON array of strings.",
    },
    { role: "user", content: synthesis },
  ], "llama-3.1-8b-instant");

  let followUpQuestions: string[] = [];
  try {
    followUpQuestions = JSON.parse(followUpRaw);
  } catch {
    followUpQuestions = [
      "What are the latest developments in this area?",
      "How does this compare to alternative approaches?",
      "What are the potential risks or limitations?",
    ];
  }

  // ── Step 6: Visualizer Agent ────────────────────────────────
  // Generates mind map / flowchart image
  const mindMapPrompt = await callGroq([
    {
      role: "system",
      content: `Create a detailed image generation prompt for a ${researchPlan.visualizationType} visualizing this research.
Requirements:
- Clean, professional design
- Clear nodes with labels
- Connected with lines/arrows
- Color-coded sections
- White or light background
- Text must be readable
- No photorealistic elements, diagram style only`,
    },
    { role: "user", content: synthesis.slice(0, 2000) },
  ], "llama-3.1-8b-instant");

  const mindMapImageUrl = await generateImage(mindMapPrompt);

  return {
    answer: synthesis,
    sources: rawSources.map((s) => ({ title: s.title, url: s.url, content: s.content })),
    mindMapImageUrl,
    followUpQuestions,
  };
}