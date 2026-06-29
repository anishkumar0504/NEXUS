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
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-[20px] border border-[var(--border-2)] bg-[var(--bg-3)] backdrop-blur-sm"
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
      <span className="text-[11px] font-medium text-[var(--text-2)] font-[var(--font)] tracking-[0.01em] leading-none">
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
        border: "2px solid var(--border-2)",
        borderTopColor: "var(--accent)",
      }}
    />
  );
}

function LivePulse() {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-[7px] h-[7px] rounded-full inline-block animate-pulse"
        style={{
          background: "var(--accent)",
          boxShadow: "0 0 10px var(--accent-glow), 0 0 20px rgba(99,102,241,0.2)",
        }}
      />
      <span className="text-[11px] font-medium text-[var(--accent-2)] font-[var(--font)] tracking-[0.02em]">
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
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl overflow-hidden backdrop-blur-xl border border-[var(--border)]"
      style={{
        background: "linear-gradient(180deg, rgba(17,17,20,0.95) 0%, rgba(10,10,11,0.98) 100%)",
        boxShadow: "0 0 0 1px rgba(99,102,241,0.06), 0 20px 50px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      {/* Top gradient glow line */}
      <div
        className="w-full h-px"
        style={{
          maxWidth: 520,
          background: "linear-gradient(90deg, transparent, var(--accent-glow), transparent)",
          opacity: isComplete ? 0 : 0.6,
        }}
      />

      {/* Progress bar */}
      <div className="h-[3px] bg-[var(--bg-3)] relative overflow-hidden">
        <motion.div
          className="h-full rounded-r-[3px]"
          style={{
            background: "linear-gradient(90deg, var(--accent), var(--accent-2), var(--accent))",
            backgroundSize: "200% 100%",
            boxShadow: "0 0 12px rgba(99,102,241,0.3)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* Shimmer effect on progress bar */}
        {!isComplete && (
          <motion.div
            className="absolute inset-0 w-[30%]"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
            }}
            animate={{ x: ["-100%", "400%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-[18px] pb-3.5 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div
            className="w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0 relative"
            style={{
              background: "linear-gradient(135deg, var(--accent-glow), rgba(99,102,241,0.08))",
              border: "1px solid rgba(99,102,241,0.15)",
            }}
          >
            <svg
              width={17}
              height={17}
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx={11} cy={11} r={8} />
              <path d="m21 21-4.35-4.35" />
            </svg>
            {/* Orbiting dot */}
            {!isComplete && (
              <motion.div
                className="absolute w-1 h-1 rounded-full"
                style={{
                  background: "var(--accent-2)",
                  boxShadow: "0 0 6px var(--accent)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[var(--text)] tracking-[-0.01em] leading-[1.3] font-[var(--font)]">
              Research Agent
            </p>
            <p className="text-xs text-[var(--text-3)] leading-relaxed mt-0.5 font-[var(--font)]">
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
      <div className="py-3">
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
                  opacity: isPending ? 0.3 : 1,
                  background: isActive ? "rgba(99,102,241,0.03)" : "transparent",
                }}
                transition={{ duration: 0.3 }}
                className={`flex items-start gap-3.5 px-5 py-2.5 ${isActive ? "mx-2 rounded-lg" : ""}`}
              >
                {/* Left: step indicator + connector */}
                <div className="flex flex-col items-center shrink-0 mt-px">
                  <motion.div
                    animate={
                      isActive
                        ? {
                            boxShadow: [
                              "0 0 0 0px rgba(99,102,241,0)",
                              "0 0 0 5px rgba(99,102,241,0.1)",
                              "0 0 0 0px rgba(99,102,241,0)",
                            ],
                          }
                        : {}
                    }
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-[26px] h-[26px] rounded-lg flex items-center justify-center text-[11px] font-bold font-[var(--mono)] transition-all duration-[400ms]"
                    style={{
                      transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                      ...(isDone
                        ? {
                            background: "rgba(34,197,94,0.1)",
                            color: "var(--green)",
                            border: "1.5px solid rgba(34,197,94,0.25)",
                          }
                        : isActive
                        ? {
                            background: "linear-gradient(135deg, var(--accent-glow), rgba(99,102,241,0.1))",
                            color: "var(--accent)",
                            border: "1.5px solid rgba(99,102,241,0.3)",
                          }
                        : {
                            background: "var(--bg-3)",
                            color: "var(--text-3)",
                            border: "1.5px solid var(--border)",
                          }),
                    }}
                  >
                    {isDone ? (
                      <svg
                        width={12}
                        height={12}
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
                      className="w-0.5 mt-1 transition-all duration-500 ease-[ease]"
                      style={{
                        height: 22,
                        minHeight: 22,
                        ...(isDone
                          ? {
                              background:
                                "linear-gradient(180deg, rgba(34,197,94,0.35) 0%, rgba(34,197,94,0.08) 100%)",
                            }
                          : {
                              background: "var(--border)",
                            }),
                      }}
                    />
                  )}
                </div>

                {/* Right: text + badge */}
                <div className="flex-1 min-w-0 flex items-start justify-between gap-3 pt-[3px]">
                  <div className="min-w-0">
                    <p
                      className={`text-sm leading-[1.4] transition-all duration-300 font-[var(--font)] ${
                        isActive ? "font-semibold text-[var(--text)]" : "font-medium text-[var(--text-3)]"
                      }`}
                    >
                      {cfg.name}
                    </p>
                    <AnimatePresence mode="wait">
                      {(isActive || isDone) && (
                        <motion.p
                          key={step?.status}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.25 }}
                          className="text-xs text-[var(--text-2)] mt-1 leading-relaxed font-[var(--font)]"
                        >
                          {isActive ? cfg.running : cfg.done}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 mt-px">
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
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-2.5 px-5 py-3.5"
            style={{
              borderTop: "1px solid rgba(34,197,94,0.15)",
              background: "linear-gradient(180deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))",
            }}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: "var(--green)",
                boxShadow: "0 0 10px rgba(34,197,94,0.4), 0 0 20px rgba(34,197,94,0.15)",
              }}
            />
            <span className="text-[13px] font-semibold text-[var(--green)] font-[var(--font)]">
              Research complete
            </span>
            <span className="text-xs text-[var(--text-3)] ml-auto font-[var(--font)]">
              {steps.length} steps finished
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}