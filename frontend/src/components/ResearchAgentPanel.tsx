"use client";

import { useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  siDeepseek,
  siMeta,
  siMetaai,
  siGooglegemini,
  siMistralai,
  siAnthropic,
} from "simple-icons";

const FALLBACK_ICONS: Record<string, { hex: string }> = {
  tavily:      { hex: "0070f3" },
  groq:        { hex: "f97316" },
  openai:      { hex: "412991" },
  openrouter:  { hex: "6366f1" },
  pollinations:{ hex: "10b981" },
};

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

// ─── LLM registry ─────────────────────────────────────────────────────────────

interface LLMInfo {
  name: string;
  icon: { path: string; hex: string } | null;
  color: string;
}

const LLM_REGISTRY: Record<string, LLMInfo> = {
  tavily: {
    name: "Tavily",
    icon: null,
    color: `#${FALLBACK_ICONS.tavily.hex}`,
  },
  groq: {
    name: "Groq",
    icon: null,
    color: `#${FALLBACK_ICONS.groq.hex}`,
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
    icon: siMetaai,
    color: `#${siMetaai.hex}`,
  },
  "meta-llama/llama-4-maverick": {
    name: "Llama 4 Maverick",
    icon: siMetaai,
    color: `#${siMetaai.hex}`,
  },
  "llama-3.1-8b-instant": {
    name: "Llama 3.1",
    icon: siMetaai,
    color: `#${siMetaai.hex}`,
  },
  "llama-3.3-70b-versatile": {
    name: "Llama 3.3",
    icon: siMetaai,
    color: `#${siMetaai.hex}`,
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
    icon: null,
    color: `#${FALLBACK_ICONS.openai.hex}`,
  },
  "openai/gpt-oss-20b": {
    name: "GPT-OSS",
    icon: null,
    color: `#${FALLBACK_ICONS.openai.hex}`,
  },
  mistral: {
    name: "Mistral",
    icon: siMistralai,
    color: `#${siMistralai.hex}`,
  },
  "mistralai/mistral-small-3.1-24b-instruct": {
    name: "Mistral",
    icon: siMistralai,
    color: `#${siMistralai.hex}`,
  },
  anthropic: {
    name: "Claude",
    icon: siAnthropic,
    color: `#${siAnthropic.hex}`,
  },
  openrouter: {
    name: "OpenRouter",
    icon: null,
    color: `#${FALLBACK_ICONS.openrouter.hex}`,
  },
  pollinations: {
    name: "Pollinations",
    icon: null,
    color: `#${FALLBACK_ICONS.pollinations.hex}`,
  },
};

function getLLM(entity: string): LLMInfo {
  return (
    LLM_REGISTRY[entity] ?? {
      name: entity,
      icon: null,
      color: "#606075",
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
      className="block shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

function LLMBadge({ entity }: { entity: string }) {
  const llm = getLLM(entity);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, x: 8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.85, x: 4 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.04] backdrop-blur-md"
    >
      {llm.icon ? (
        <SimpleIcon path={llm.icon.path} color={llm.color} size={12} />
      ) : (
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{
            background: llm.color,
            boxShadow: `0 0 6px ${llm.color}40`,
          }}
        />
      )}
      <span className="text-[11px] font-medium text-white/60 font-[var(--font)] tracking-wide leading-none">
        {llm.name}
      </span>
    </motion.div>
  );
}

function Spinner() {
  return (
    <div
      className="w-4 h-4 shrink-0 rounded-full animate-spin"
      style={{
        border: "2px solid rgba(255,255,255,0.08)",
        borderTopColor: "var(--accent)",
      }}
    />
  );
}

function LivePulse() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]"></span>
      </span>
      <span className="text-[11px] font-semibold text-[var(--accent)] font-[var(--font)] tracking-wider uppercase">
        Live
      </span>
    </div>
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

  const progressPercent = useMemo(() => {
    const completed = steps.filter((s) => s.status === "complete").length;
    return (completed / 5) * 100;
  }, [steps]);

  const activeStepName = currentStep > 0 ? STEP_CONFIG[currentStep]?.name : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-[520px] rounded-2xl sm:rounded-3xl overflow-hidden backdrop-blur-2xl border border-white/[0.06]"
      style={{
        background: "linear-gradient(165deg, rgba(23,23,28,0.92) 0%, rgba(12,12,15,0.96) 50%, rgba(8,8,11,0.98) 100%)",
        boxShadow: `
          0 0 0 1px rgba(99,102,241,0.04),
          0 1px 1px rgba(0,0,0,0.15),
          0 4px 8px rgba(0,0,0,0.2),
          0 12px 24px rgba(0,0,0,0.3),
          0 32px 64px rgba(0,0,0,0.25),
          inset 0 1px 0 rgba(255,255,255,0.04)
        `,
      }}
    >
      {/* Ambient top glow */}
      <div
        className="w-full h-[1.5px]"
        style={{
          background: isComplete
            ? "linear-gradient(90deg, transparent, rgba(34,197,94,0.3), transparent)"
            : "linear-gradient(90deg, transparent, rgba(99,102,241,0.25), rgba(139,92,246,0.15), transparent)",
          opacity: isComplete ? 0.8 : 1,
        }}
      />

      {/* Progress bar */}
      <div className="h-1 bg-white/[0.03] relative overflow-hidden">
        <motion.div
          className="h-full rounded-r-full"
          style={{
            background: isComplete
              ? "linear-gradient(90deg, rgba(34,197,94,0.8), rgba(34,197,94,0.4))"
              : "linear-gradient(90deg, rgba(99,102,241,0.9), rgba(139,92,246,0.7), rgba(99,102,241,0.9))",
            backgroundSize: "200% 100%",
            boxShadow: isComplete
              ? "0 0 16px rgba(34,197,94,0.3)"
              : "0 0 16px rgba(99,102,241,0.25), 0 0 32px rgba(99,102,241,0.1)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* Shimmer effect */}
        {!isComplete && (
          <motion.div
            className="absolute inset-0 w-[40%]"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
            }}
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          {/* Icon container with glass effect */}
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.06))",
              border: "1px solid rgba(99,102,241,0.12)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(99,102,241,0.1)",
            }}
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="relative z-10"
            >
              <circle cx={11} cy={11} r={8} />
              <path d="m21 21-4.35-4.35" />
            </svg>
            {/* Subtle inner glow */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: "radial-gradient(circle at 30% 30%, rgba(99,102,241,0.3), transparent 70%)",
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-[15px] font-semibold text-white/90 tracking-tight leading-tight font-[var(--font)]">
              Research Agent
            </p>
            <p className="text-[11px] sm:text-xs text-white/40 leading-relaxed mt-0.5 font-[var(--font)]">
              {isComplete
                ? "Research complete"
                : currentStep > 0
                ? `Step ${currentStep} of 5 — ${activeStepName}`
                : "Preparing research workflow…"}
            </p>
          </div>
        </div>
        {!isComplete && currentStep > 0 && <LivePulse />}
      </div>

      {/* Steps */}
      <div className="py-2 sm:py-3">
        {[1, 2, 3, 4, 5].map((num, i) => {
          const step = steps.find((s) => s.step === num);
          const cfg = STEP_CONFIG[num];
          const isDone = step?.status === "complete";
          const isActive = step?.status === "running";
          const isPending = !step;
          const isLast = i === 4;

          const entity = step?.tool ?? step?.model ?? step?.provider ?? "";

          return (
            <div key={num}>
              <motion.div
                initial={false}
                animate={{
                  opacity: isPending ? 0.25 : 1,
                  background: isActive ? "rgba(99,102,241,0.025)" : "transparent",
                }}
                transition={{ duration: 0.4 }}
                className={`flex items-start gap-3 sm:gap-3.5 px-4 sm:px-6 py-2 sm:py-2.5 ${isActive ? "mx-2 sm:mx-3 rounded-xl" : ""}`}
              >
                {/* Left: step indicator + connector */}
                <div className="flex flex-col items-center shrink-0 mt-0.5">
                  <motion.div
                    animate={
                      isActive
                        ? {
                            boxShadow: [
                              "0 0 0 0px rgba(99,102,241,0)",
                              "0 0 0 6px rgba(99,102,241,0.08)",
                              "0 0 0 0px rgba(99,102,241,0)",
                            ],
                          }
                        : {}
                    }
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl flex items-center justify-center text-[10px] sm:text-[11px] font-bold font-[var(--mono)] transition-all duration-500"
                    style={{
                      transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                      ...(isDone
                        ? {
                            background: "rgba(34,197,94,0.08)",
                            color: "#4ade80",
                            border: "1px solid rgba(34,197,94,0.2)",
                            boxShadow: "0 0 12px rgba(34,197,94,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
                          }
                        : isActive
                        ? {
                            background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05))",
                            color: "var(--accent)",
                            border: "1px solid rgba(99,102,241,0.2)",
                            boxShadow: "0 0 16px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
                          }
                        : {
                            background: "rgba(255,255,255,0.03)",
                            color: "rgba(255,255,255,0.25)",
                            border: "1px solid rgba(255,255,255,0.05)",
                          }),
                    }}
                  >
                    {isDone ? (
                      <svg
                        width={11}
                        height={11}
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="2,6 5,9 10,3" />
                      </svg>
                    ) : (
                      num
                    )}
                  </motion.div>
                  {!isLast && (
                    <div
                      className="w-px mt-1 transition-all duration-700"
                      style={{
                        height: 20,
                        minHeight: 20,
                        ...(isDone
                          ? {
                              background:
                                "linear-gradient(180deg, rgba(34,197,94,0.25) 0%, rgba(34,197,94,0.05) 100%)",
                            }
                          : {
                              background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
                            }),
                      }}
                    />
                  )}
                </div>

                {/* Right: text + badge */}
                <div className="flex-1 min-w-0 flex items-start justify-between gap-2 sm:gap-3 pt-0.5 sm:pt-1">
                  <div className="min-w-0">
                    <p
                      className={`text-[13px] sm:text-sm leading-snug transition-all duration-300 font-[var(--font)] ${
                        isActive
                          ? "font-semibold text-white/90"
                          : isDone
                          ? "font-medium text-white/40"
                          : "font-medium text-white/25"
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
                          exit={{ opacity: 0, y: -2 }}
                          transition={{ duration: 0.2 }}
                          className="text-[11px] sm:text-xs text-white/50 mt-1 leading-relaxed font-[var(--font)]"
                        >
                          {isActive ? cfg.running : cfg.done}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
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
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-2.5 px-4 sm:px-6 py-3 sm:py-4"
            style={{
              borderTop: "1px solid rgba(34,197,94,0.1)",
              background: "linear-gradient(180deg, rgba(34,197,94,0.04), rgba(34,197,94,0.01))",
            }}
          >
            <div className="relative flex h-2.5 w-2.5">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                style={{ background: "#4ade80" }}
              />
              <span
                className="relative inline-flex rounded-full h-2.5 w-2.5"
                style={{
                  background: "#4ade80",
                  boxShadow: "0 0 10px rgba(74,222,128,0.4), 0 0 20px rgba(74,222,128,0.15)",
                }}
              />
            </div>
            <span className="text-xs sm:text-[13px] font-semibold text-[#4ade80] font-[var(--font)]">
              Research complete
            </span>
            <span className="text-[11px] sm:text-xs text-white/30 ml-auto font-[var(--font)]">
              {steps.length} steps finished
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}