"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  siTavily,
  siGroq,
  siDeepseek,
  siMeta,
  siGooglegemini,
  siOpenai,
  siMistral,
  siAnthropic,
} from "simple-icons";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResearchStep {
  step: number;
  status: "running" | "complete" | "error";
  tool?: string;
  model?: string;
  provider?: string;
  label?: string;
}

interface ResearchAgentPanelProps {
  jobId: string;
  socket: any;
}

// ─── Step config ──────────────────────────────────────────────────────────────

const STEP_CONFIG: Record<
  number,
  { name: string; running: string; done: string }
> = {
  1: {
    name: "Search",
    running: "Querying the web for relevant sources…",
    done: "Sources collected and ranked",
  },
  2: {
    name: "Extract",
    running: "Reading and chunking page content…",
    done: "Content extracted and tokenised",
  },
  3: {
    name: "Synthesize",
    running: "Reasoning across sources…",
    done: "Draft answer synthesised",
  },
  4: {
    name: "Follow-ups",
    running: "Generating related questions…",
    done: "Follow-up questions ready",
  },
  5: {
    name: "Visualize",
    running: "Formatting the final response…",
    done: "Response formatted and ready",
  },
};

// ─── LLM registry (simple-icons + fallback colour) ────────────────────────────

interface LLMInfo {
  name: string;
  icon: { path: string; hex: string } | null;
  color: string;
}

const LLM_REGISTRY: Record<string, LLMInfo> = {
  tavily: {
    name: "Tavily",
    icon: siTavily,
    color: `#${siTavily.hex}`,
  },
  groq: {
    name: "Groq",
    icon: siGroq,
    color: `#${siGroq.hex}`,
  },
  deepseek: {
    name: "DeepSeek",
    icon: siDeepseek,
    color: `#${siDeepseek.hex}`,
  },
  "deepseek/deepseek-chat-v3-0324": {
    name: "DeepSeek",
    icon: siDeepseek,
    color: `#${siDeepseek.hex}`,
  },
  "deepseek/deepseek-r1": {
    name: "DeepSeek R1",
    icon: siDeepseek,
    color: `#${siDeepseek.hex}`,
  },
  meta: {
    name: "Llama",
    icon: siMeta,
    color: `#${siMeta.hex}`,
  },
  "meta-llama/llama-4-scout": {
    name: "Llama 4 Scout",
    icon: siMeta,
    color: `#${siMeta.hex}`,
  },
  "meta-llama/llama-4-maverick": {
    name: "Llama 4 Maverick",
    icon: siMeta,
    color: `#${siMeta.hex}`,
  },
  googlegemini: {
    name: "Gemini",
    icon: siGooglegemini,
    color: `#${siGooglegemini.hex}`,
  },
  "google/gemma-3-27b-it": {
    name: "Gemma",
    icon: siGooglegemini,
    color: `#${siGooglegemini.hex}`,
  },
  openai: {
    name: "OpenAI",
    icon: siOpenai,
    color: `#${siOpenai.hex}`,
  },
  "openai/gpt-oss-20b": {
    name: "GPT-OSS",
    icon: siOpenai,
    color: `#${siOpenai.hex}`,
  },
  mistral: {
    name: "Mistral",
    icon: siMistral,
    color: `#${siMistral.hex}`,
  },
  "mistralai/mistral-small-3.1-24b-instruct": {
    name: "Mistral",
    icon: siMistral,
    color: `#${siMistral.hex}`,
  },
  anthropic: {
    name: "Claude",
    icon: siAnthropic,
    color: `#${siAnthropic.hex}`,
  },
  openrouter: {
    name: "OpenRouter",
    icon: null,
    color: "#6366f1",
  },
  pollinations: {
    name: "Pollinations",
    icon: null,
    color: "#10b981",
  },
};

function getLLM(entity: string): LLMInfo {
  return (
    LLM_REGISTRY[entity] ?? {
      name: entity,
      icon: null,
      color: "#6b7280",
    }
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SimpleIcon({
  path,
  color,
  size = 13,
}: {
  path: string;
  color: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={path} />
    </svg>
  );
}

function LLMBadge({ entity }: { entity: string }) {
  const llm = getLLM(entity);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
    >
      {llm.icon ? (
        <SimpleIcon path={llm.icon.path} color={llm.color} size={12} />
      ) : (
        <span
          className="w-3 h-3 rounded-sm flex-shrink-0"
          style={{ background: llm.color }}
        />
      )}
      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-none">
        {llm.name}
      </span>
    </motion.div>
  );
}

function Spinner() {
  return (
    <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-blue-500 animate-spin flex-shrink-0" />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResearchAgentPanel({ jobId, socket }: ResearchAgentPanelProps) {
  const [steps, setSteps] = useState<ResearchStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleStep = (data: ResearchStep & { jobId: string }) => {
      if (data.jobId !== jobId) return;

      setSteps((prev) => {
        const idx = prev.findIndex((s) => s.step === data.step);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data;
          return updated;
        }
        return [...prev, data];
      });

      if (data.status === "running") setCurrentStep(data.step);
    };

    const handleComplete = (data: { jobId: string }) => {
      if (data.jobId === jobId) {
        setIsComplete(true);
        setCurrentStep(0);
      }
    };

    const handleError = (data: { jobId: string }) => {
      if (data.jobId === jobId) setIsComplete(true);
    };

    socket.on("research:step", handleStep);
    socket.on("research:complete", handleComplete);
    socket.on("research:error", handleError);

    return () => {
      socket.off("research:step", handleStep);
      socket.off("research:complete", handleComplete);
      socket.off("research:error", handleError);
    };
  }, [jobId, socket]);

  return (
    <div className="w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight">
            Research agent
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">
            {isComplete
              ? "Complete"
              : currentStep > 0
              ? `Step ${currentStep} of 5 — ${STEP_CONFIG[currentStep]?.name}`
              : "Initialising…"}
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="py-1">
        {[1, 2, 3, 4, 5].map((num, i) => {
          const step = steps.find((s) => s.step === num);
          const cfg = STEP_CONFIG[num];
          const isDone = step?.status === "complete";
          const isActive = step?.status === "running";
          const isPending = !step;
          const isLast = i === 4;

          const entity =
            step?.tool ?? step?.model ?? step?.provider ?? "";

          return (
            <div key={num}>
              <motion.div
                initial={false}
                animate={{ opacity: isPending ? 0.3 : 1 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2.5 px-3.5 py-2"
              >
                {/* Left: number + connector */}
                <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-semibold transition-colors duration-200 ${
                      isDone
                        ? "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400"
                        : isActive
                        ? "bg-blue-50 dark:bg-blue-950 text-blue-500"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                    }`}
                  >
                    {isDone ? (
                      <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
                        <polyline points="2,6 5,9 10,3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      num
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={`w-px mt-1 transition-all duration-500 ${
                        isDone
                          ? "h-full min-h-[14px] bg-green-200 dark:bg-green-900"
                          : "h-full min-h-[14px] bg-gray-100 dark:bg-gray-800"
                      }`}
                    />
                  )}
                </div>

                {/* Right: text + badge */}
                <div className="flex-1 min-w-0 flex items-start justify-between gap-2 pb-1">
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-medium leading-tight transition-colors duration-200 ${
                        isDone
                          ? "text-gray-400 dark:text-gray-600"
                          : isActive
                          ? "text-gray-900 dark:text-gray-100"
                          : "text-gray-400 dark:text-gray-600"
                      }`}
                    >
                      {cfg.name}
                    </p>
                    <AnimatePresence mode="wait">
                      {(isActive || isDone) && (
                        <motion.p
                          key={step?.status}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-snug"
                        >
                          {isActive ? cfg.running : cfg.done}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                    <AnimatePresence>
                      {isDone && entity && <LLMBadge entity={entity} />}
                    </AnimatePresence>
                    {isActive && <Spinner />}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Done bar */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="border-t border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-950 px-3.5 py-2 flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-[10px] font-medium text-green-600 dark:text-green-400">
              Research complete
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}