import { tavily } from "@tavily/core";

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ============================================================================
// VERIFIED WORKING FREE MODELS (June 2026) — NO :free SUFFIX
// ============================================================================
export interface ResearchStep {
  step: number;
  status: "running" | "complete" | "error";
  tool?: string;
  model?: string;
  provider?: string;
  label?: string;
  sourcesCount?: number;
  imageUrl?: string;
  error?: string;
}

export interface ResearchResult {
  answer: string;
  sources: { title: string; url: string; content: string }[];
  mindMapImageUrl: string | null;
  followUpQuestions: string[];
}

export interface ResearchCallbacks {
  onStep?: (step: ResearchStep) => void;
  onComplete?: (result: ResearchResult) => void;
  onError?: (error: string) => void;
}
const MODELS = {
  extract: {
    primary: [
      "openrouter/free",                    // Auto-router — always works
      "meta-llama/llama-4-scout",           // Fast, 128K
      "google/gemma-3-27b-it",              // Lightweight
      "mistralai/mistral-small-3.1-24b-instruct", // Balanced
    ],
    fallback: "llama-3.1-8b-instant",      // Groq
  },
  synthesize: {
    primary: [
      "openrouter/free",                    // Auto-router
      "nvidia/nemotron-3-super",            // 1M context, strong reasoning
      "meta-llama/llama-4-maverick",        // 1M context, multimodal
      "deepseek/deepseek-r1",               // Strong reasoning (slower)
      "qwen/qwen3-235b-a22b",               // Coding/analysis
    ],
    fallback: "llama-3.3-70b-versatile",     // Groq
  },
  followUp: {
    primary: [
      "openrouter/free",
      "meta-llama/llama-4-scout",
      "google/gemma-3-27b-it",
      "x-ai/grok-3-mini-beta",              // Fast responses
    ],
    fallback: "llama-3.1-8b-instant",       // Groq
  },
  imagePrompt: {
    primary: [
      "openrouter/free",
      "meta-llama/llama-4-scout",
      "google/gemma-3-27b-it",
    ],
    fallback: "llama-3.1-8b-instant",       // Groq
  },
} as const;

// ============================================================================
// OPENROUTER CLIENT
// ============================================================================

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function callOpenRouter(
  messages: { role: string; content: string }[],
  model: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    retries?: number;
  } = {}
): Promise<string> {
  const {
    temperature = 0.3,
    maxTokens = 4096,
    jsonMode = false,
    retries = 2,
  } = options;

  console.log("[openrouter] Model:", model);

  for (let i = 0; i <= retries; i++) {
    try {
      const body: any = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };
      if (jsonMode) body.response_format = { type: "json_object" };

      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://nexus-chat.app",
          "X-Title": "Nexus Research Agent",
        },
        body: JSON.stringify(body),
      });

      console.log("[openrouter] Status:", response.status);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error("Empty response");
        return content;
      }

      const errText = await response.text();

      // 404 = model dead/unavailable — don't retry, skip to next model
      if (response.status === 404) {
        console.warn(`[openrouter] Model ${model} unavailable (404)`);
        throw new Error(`MODEL_DEAD: ${model}`);
      }

      // 429/503 = rate limit or overload — retry with backoff
      if ((response.status === 429 || response.status === 503) && i < retries) {
        const delay = Math.pow(2, i) * 2000 + Math.random() * 1000;
        console.warn(`[openrouter] ${response.status}, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      throw new Error(`OpenRouter HTTP ${response.status}: ${errText}`);

    } catch (err: any) {
      console.error("[openrouter] Error:", err.message);
      // Don't retry on MODEL_DEAD — bubble up immediately
      if (err.message.includes("MODEL_DEAD")) throw err;
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  throw new Error(`OpenRouter failed for ${model}`);
}

// ============================================================================
// GROQ CLIENT (fallback)
// ============================================================================

async function callGroq(
  messages: { role: string; content: string }[],
  model: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    retries?: number;
  } = {}
): Promise<string> {
  const {
    temperature = 0.3,
    maxTokens = 4096,
    jsonMode = false,
    retries = 2,
  } = options;

  console.log("[groq] Model:", model);

  for (let i = 0; i <= retries; i++) {
    try {
      const body: any = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };
      if (jsonMode) body.response_format = { type: "json_object" };

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0].message.content;
      }

      if (response.status === 429 && i < retries) {
        const errText = await response.text();
        const retryMatch = errText.match(/try again in ([\d.]+)s/);
        const delay = retryMatch
          ? parseFloat(retryMatch[1]) * 1000 + 500
          : Math.pow(2, i) * 2000;
        console.warn(`[groq] Rate limited, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      const err = await response.text();
      throw new Error(`Groq HTTP ${response.status}: ${err}`);

    } catch (err: any) {
      console.error("[groq] Error:", err.message);
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  throw new Error(`Groq failed for ${model}`);
}

// ============================================================================
// HYBRID CALLER — OpenRouter primary, Groq fallback
// ============================================================================

async function callLLM(
  messages: { role: string; content: string }[],
  config: {
    primaryModels: string[];
    fallbackModel: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }
): Promise<string> {
  const { primaryModels, fallbackModel, temperature, maxTokens, jsonMode } = config;

  // Try each OpenRouter model in order
  for (const model of primaryModels) {
    try {
      console.log(`[llm] Trying OpenRouter: ${model}`);
      const result = await callOpenRouter(messages, model, {
        temperature,
        maxTokens,
        jsonMode,
      });
      console.log(`[llm] ✅ OpenRouter success: ${model}`);
      return result;
    } catch (err: any) {
      console.warn(`[llm] ❌ OpenRouter failed (${model}):`, err.message);
      // MODEL_DEAD or other fatal error — skip to next model immediately
    }
  }

  // All OpenRouter models failed — fallback to Groq
  console.log(`[llm] Falling back to Groq: ${fallbackModel}`);
  try {
    const result = await callGroq(messages, fallbackModel, {
      temperature,
      maxTokens,
      jsonMode,
    });
    console.log(`[llm] ✅ Groq fallback success: ${fallbackModel}`);
    return result;
  } catch (err: any) {
    console.error(`[llm] ❌ Groq fallback failed:`, err.message);
    throw new Error(`All LLM providers failed. Last error: ${err.message}`);
  }
}

// ============================================================================
// SEARCH
// ============================================================================

async function searchSources(query: string) {
  const searchResult = await tvly.search(query, {
    searchDepth: "advanced",
    maxResults: 5,
    includeAnswer: true,
  });

  return searchResult.results.map((r, i) => ({
    index: i + 1,
    title: r.title,
    url: r.url,
    content: r.content.slice(0, 600),
  }));
}

async function searchSourcesFree(query: string) {
  const { search } = await import("duck-duck-scraper");
  const results = await search(query);
  return results.slice(0, 5).map((r: any, i: number) => ({
    index: i + 1,
    title: r.title,
    url: r.url,
    content: r.description?.slice(0, 600) || "",
  }));
}

// ============================================================================
// IMAGE GENERATION (Pollinations — free, no key)
// ============================================================================

function generateFreeImage(prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
}

// ============================================================================
// TYPES & UTILS
// ============================================================================

export interface ResearchResult {
  answer: string;
  sources: { title: string; url: string; content: string }[];
  mindMapImageUrl: string | null;
  followUpQuestions: string[];
}

function wantsVisualization(query: string): boolean {
  const lower = query.toLowerCase();
  const keywords = [
    "mind map", "mindmap", "diagram", "flowchart", "chart",
    "visual", "image", "picture", "infographic", "map", "graph",
  ];
  return keywords.some((kw) => lower.includes(kw));
}

// ============================================================================
// MAIN RESEARCH PIPELINE
// ============================================================================

export async function runResearch(query: string, callbacks?: ResearchCallbacks): Promise<ResearchResult> {
  const startTime = Date.now();
  console.log("[research] === START | Query:", query);

  const emitStep = (step: ResearchStep) => {
    callbacks?.onStep?.(step);
  };

  try {
    // ── Step 1: Search ─────────────────────────────────────────────────
    emitStep({ step: 1, status: "running", tool: "tavily", label: "Searching sources..." });
    console.log("[research] Step 1: Searching sources...");
    
    let rawSources;
    try {
      rawSources = await searchSources(query);
    } catch {
      emitStep({ step: 1, status: "running", tool: "duckduckgo", label: "Tavily failed, trying free search..." });
      console.warn("[research] Tavily failed, trying free search...");
      rawSources = await searchSourcesFree(query);
    }

    if (rawSources.length === 0) {
      emitStep({ step: 1, status: "error", tool: "search", label: "No sources found" });
      return {
        answer: "No sources found for this query.",
        sources: [],
        mindMapImageUrl: null,
        followUpQuestions: ["Try a broader query?", "Check spelling?"],
      };
    }

    emitStep({ step: 1, status: "complete", tool: "tavily", sourcesCount: rawSources.length, label: `${rawSources.length} sources found` });

    const sourcesText = rawSources
      .map((s) => `[${s.index}] ${s.title}: ${s.content.slice(0, 400)}`)
      .join("\n\n");

    // ── Step 2: Extract facts ──────────────────────────────────────────
    emitStep({ step: 2, status: "running", model: "openrouter/free", provider: "openrouter", label: "Extracting key facts..." });
    console.log("[research] Step 2: Extracting facts...");
    
    const extractedAll = await callLLM(
      [
        {
          role: "system",
          content: "Extract 2-3 concise key facts per source. Format strictly as:\n[1] - fact 1\n[1] - fact 2\n[2] - fact 1\netc. Be factual and concise.",
        },
        { role: "user", content: sourcesText },
      ],
      {
        primaryModels: MODELS.extract.primary,
        fallbackModel: MODELS.extract.fallback,
        temperature: 0.2,
        maxTokens: 2048,
      }
    );
    emitStep({ step: 2, status: "complete", model: "openrouter/free", provider: "openrouter", label: "Facts extracted" });

    // ── Step 3: Synthesize ─────────────────────────────────────────────
    emitStep({ step: 3, status: "running", model: "openrouter/free", provider: "openrouter", label: "Synthesizing report..." });
    console.log("[research] Step 3: Synthesizing report...");

    const extractedBySource = rawSources
      .map((s, i) => {
        const regex = new RegExp(`\\[${i + 1}\\]\\s*-\\s*(.*?)(?=\\[${i + 2}\\]|$)`, "s");
        const match = extractedAll.match(regex);
        const facts = match?.[1]?.trim().split("\n").filter(Boolean).join(" ") || "Key facts unavailable.";
        return `[${i + 1}] ${s.title}: ${facts}`;
      })
      .join("\n\n");

    const synthesis = await callLLM(
      [
        {
          role: "system",
          content: "You are a research analyst. Write a structured report with:\n1) Executive Summary (2-3 sentences)\n2) Key Findings (bullet points with [1], [2] citations)\n3) Sources Referenced\nBe concise, factual, and cite every claim.",
        },
        {
          role: "user",
          content: `Research Query: ${query}\n\nExtracted Facts:\n${extractedBySource}`,
        },
      ],
      {
        primaryModels: MODELS.synthesize.primary,
        fallbackModel: MODELS.synthesize.fallback,
        temperature: 0.3,
        maxTokens: 4096,
      }
    );
    emitStep({ step: 3, status: "complete", model: "openrouter/free", provider: "openrouter", label: "Report synthesized" });

    // ── Step 4: Follow-ups ─────────────────────────────────────────────
    emitStep({ step: 4, status: "running", model: "openrouter/free", provider: "openrouter", label: "Generating follow-ups..." });
    console.log("[research] Step 4: Generating follow-ups...");
    
    const followUpRaw = await callLLM(
      [
        {
          role: "system",
          content: 'Generate 3 relevant follow-up research questions. Return ONLY a JSON object: {"questions":["q1","q2","q3"]}',
        },
        {
          role: "user",
          content: `Based on this research summary, what should the user explore next?\n\n${synthesis.slice(0, 1200)}`,
        },
      ],
      {
        primaryModels: MODELS.followUp.primary,
        fallbackModel: MODELS.followUp.fallback,
        temperature: 0.4,
        maxTokens: 512,
        jsonMode: true,
      }
    );
    emitStep({ step: 4, status: "complete", model: "openrouter/free", provider: "openrouter", label: "Follow-ups ready" });

    let followUpQuestions: string[] = [];
    try {
      const parsed = JSON.parse(followUpRaw);
      followUpQuestions = parsed.questions || parsed;
    } catch {
      const match = followUpRaw.match(/\[\s*"[^"]+"\s*(?:,\s*"[^"]+"\s*){2}\]/);
      if (match) {
        try { followUpQuestions = JSON.parse(match[0]); } catch { /* ignore */ }
      }
      if (followUpQuestions.length === 0) {
        followUpQuestions = ["Latest developments?", "Alternative approaches?", "Potential risks?"];
      }
    }

    // ── Step 5: Image (conditional) ────────────────────────────────────
    let mindMapImageUrl: string | null = null;

    if (wantsVisualization(query)) {
      emitStep({ step: 5, status: "running", tool: "pollinations", label: "Generating visualization..." });
      console.log("[research] Step 5: Generating visualization...");
      
      try {
        const imagePrompt = await callLLM(
          [
            {
              role: "system",
              content: "Write a detailed 80-word image generation prompt for a mind map. Include: clean white background, interconnected nodes, color-coded branches, arrows, professional infographic style, high detail.",
            },
            { role: "user", content: `Topic: ${query}` },
          ],
          {
            primaryModels: MODELS.imagePrompt.primary,
            fallbackModel: MODELS.imagePrompt.fallback,
            temperature: 0.5,
            maxTokens: 256,
          }
        );

        mindMapImageUrl = generateFreeImage(imagePrompt);
        emitStep({ step: 5, status: "complete", tool: "pollinations", imageUrl: mindMapImageUrl, label: "Visualization ready" });
        console.log("[research] Image URL:", mindMapImageUrl);
      } catch (imgErr: any) {
        emitStep({ step: 5, status: "error", tool: "pollinations", label: "Image generation failed" });
        console.warn("[research] Image prompt gen failed:", imgErr.message);
        mindMapImageUrl = null;
      }
    } else {
      emitStep({ step: 5, status: "complete", label: "No visualization requested" });
      console.log("[research] Step 5: No visualization requested.");
    }

    // ── Return ─────────────────────────────────────────────────────────
    const result: ResearchResult = {
      answer: synthesis,
      sources: rawSources.map((s) => ({ title: s.title, url: s.url, content: s.content })),
      mindMapImageUrl,
      followUpQuestions,
    };

    callbacks?.onComplete?.(result);

    const duration = Date.now() - startTime;
    console.log(`[research] === COMPLETE in ${duration}ms ===`);
    return result;

  } catch (error: any) {
    callbacks?.onError?.(error.message);
    console.error("[research] Pipeline failed:", error.message);
    throw error;
  }
}
// ============================================================================
// BATCH RESEARCH
// ============================================================================

export async function runBatchResearch(
  queries: string[]
): Promise<ResearchResult[]> {
  console.log("[research] Batch started:", queries.length, "queries");
  return Promise.all(queries.map((q) => runResearch(q)));
}


