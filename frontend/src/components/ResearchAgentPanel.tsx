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
  size = 12,
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
      style={{ flexShrink: 0 }}
    >
      <path d={path} />
    </svg>
  );
}

function LLMBadge({ entity }: { entity: string }) {
  const llm = getLLM(entity);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: "var(--bg-3)",
      }}
    >
      {llm.icon ? (
        <SimpleIcon path={llm.icon.path} color={llm.color} size={11} />
      ) : (
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: llm.color,
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: "var(--text-2)",
          fontFamily: "var(--font)",
          letterSpacing: "0.01em",
          lineHeight: 1,
        }}
      >
        {llm.name}
      </span>
    </motion.div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 14,
        height: 14,
        flexShrink: 0,
        borderRadius: "50%",
        border: "2px solid var(--border)",
        borderTopColor: "var(--accent)",
      }}
      className="animate-spin"
    />
  );
}

function PulseDot() {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "var(--accent)",
        boxShadow: "0 0 8px var(--accent-glow)",
        display: "inline-block",
      }}
      className="animate-pulse"
    />
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.02)",
        maxWidth: 320,
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          height: 2,
          background: "var(--bg-3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <motion.div
          style={{
            height: "100%",
            background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
            borderRadius: "0 2px 2px 0",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "var(--accent-glow)",
            border: "1px solid rgba(99,102,241,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx={11} cy={11} r={8} />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              letterSpacing: "-0.01em",
              lineHeight: 1.3,
              fontFamily: "var(--font)",
            }}
          >
            Research Agent
          </p>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              lineHeight: 1.4,
              marginTop: 1,
              fontFamily: "var(--font)",
            }}
          >
            {isComplete
              ? "Complete"
              : currentStep > 0
              ? `Step ${currentStep} of 5 — ${STEP_CONFIG[currentStep]?.name}`
              : "Initialising…"}
          </p>
        </div>
        {!isComplete && currentStep > 0 && <PulseDot />}
      </div>

      {/* Steps */}
      <div style={{ padding: "8px 0" }}>
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
                animate={{ opacity: isPending ? 0.35 : 1 }}
                transition={{ duration: 0.25 }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "7px 16px",
                }}
              >
                {/* Left: step indicator + connector */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <motion.div
                    animate={
                      isActive
                        ? {
                            boxShadow: [
                              "0 0 0 0px rgba(99,102,241,0)",
                              "0 0 0 4px rgba(99,102,241,0.12)",
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
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 700,
                      fontFamily: "var(--mono)",
                      transition: "all 0.3s ease",
                      ...(isDone
                        ? {
                            background: "rgba(34,197,94,0.1)",
                            color: "var(--green)",
                            border: "1px solid rgba(34,197,94,0.2)",
                          }
                        : isActive
                        ? {
                            background: "var(--accent-glow)",
                            color: "var(--accent)",
                            border: "1px solid rgba(99,102,241,0.25)",
                          }
                        : {
                            background: "var(--bg-3)",
                            color: "var(--text-3)",
                            border: "1px solid var(--border)",
                          }),
                    }}
                  >
                    {isDone ? (
                      <svg
                        width={10}
                        height={10}
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
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
                      style={{
                        width: 1,
                        marginTop: 3,
                        transition: "all 0.5s ease",
                        ...(isDone
                          ? {
                              height: 16,
                              minHeight: 16,
                              background:
                                "linear-gradient(180deg, rgba(34,197,94,0.3), rgba(34,197,94,0.08))",
                            }
                          : {
                              height: 16,
                              minHeight: 16,
                              background: "var(--border)",
                            }),
                      }}
                    />
                  )}
                </div>

                {/* Right: text + badge */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                    paddingBottom: 2,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        lineHeight: 1.4,
                        transition: "color 0.3s ease",
                        fontFamily: "var(--font)",
                        ...(isDone
                          ? { color: "var(--text-3)" }
                          : isActive
                          ? { color: "var(--text)" }
                          : { color: "var(--text-3)" }),
                      }}
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
                          style={{
                            fontSize: 10,
                            color: "var(--text-3)",
                            marginTop: 2,
                            lineHeight: 1.5,
                            fontFamily: "var(--font)",
                          }}
                        >
                          {isActive ? cfg.running : cfg.done}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
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
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
              borderTop: "1px solid var(--border)",
              background: "rgba(34,197,94,0.06)",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--green)",
                boxShadow: "0 0 6px rgba(34,197,94,0.4)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--green)",
                fontFamily: "var(--font)",
              }}
            >
              Research complete
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}