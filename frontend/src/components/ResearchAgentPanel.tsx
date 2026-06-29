"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  siDeepseek,
  siMeta,
  siMetaai,
  siGooglegemini,
  siMistralai,
  siAnthropic,
} from "simple-icons";

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

const STEP_CONFIG: Record<number, { name: string; running: string; done: string }> = {
  1: { name: "Search",     running: "Querying the web for relevant sources…", done: "Sources collected and ranked" },
  2: { name: "Extract",    running: "Reading and chunking page content…",     done: "Content extracted and tokenised" },
  3: { name: "Synthesize", running: "Reasoning across sources…",              done: "Draft answer synthesised" },
  4: { name: "Follow-ups", running: "Generating related questions…",          done: "Follow-up questions ready" },
  5: { name: "Visualize",  running: "Formatting the final response…",         done: "Response formatted and ready" },
};

interface LLMInfo { name: string; icon: { path: string; hex: string } | null; color: string; }

const LLM_REGISTRY: Record<string, LLMInfo> = {
  tavily:                                       { name: "Tavily",        icon: null,           color: "#0070f3" },
  groq:                                         { name: "Groq",          icon: null,           color: "#f97316" },
  deepseek:                                     { name: "DeepSeek",      icon: siDeepseek,     color: `#${siDeepseek.hex}` },
  "deepseek/deepseek-chat-v3-0324":             { name: "DeepSeek",      icon: siDeepseek,     color: `#${siDeepseek.hex}` },
  "deepseek/deepseek-r1":                       { name: "DeepSeek R1",   icon: siDeepseek,     color: `#${siDeepseek.hex}` },
  meta:                                         { name: "Llama",         icon: siMeta,         color: `#${siMeta.hex}` },
  "meta-llama/llama-4-scout":                   { name: "Llama 4 Scout", icon: siMetaai,       color: `#${siMetaai.hex}` },
  "meta-llama/llama-4-maverick":                { name: "Llama 4",       icon: siMetaai,       color: `#${siMetaai.hex}` },
  "llama-3.1-8b-instant":                       { name: "Llama 3.1",     icon: siMetaai,       color: `#${siMetaai.hex}` },
  "llama-3.3-70b-versatile":                    { name: "Llama 3.3",     icon: siMetaai,       color: `#${siMetaai.hex}` },
  googlegemini:                                 { name: "Gemini",        icon: siGooglegemini, color: `#${siGooglegemini.hex}` },
  "google/gemma-3-27b-it":                      { name: "Gemma",         icon: siGooglegemini, color: `#${siGooglegemini.hex}` },
  openai:                                       { name: "OpenAI",        icon: null,           color: "#412991" },
  "openai/gpt-oss-20b":                         { name: "GPT-OSS",       icon: null,           color: "#412991" },
  mistral:                                      { name: "Mistral",       icon: siMistralai,    color: `#${siMistralai.hex}` },
  "mistralai/mistral-small-3.1-24b-instruct":   { name: "Mistral",       icon: siMistralai,    color: `#${siMistralai.hex}` },
  anthropic:                                    { name: "Claude",        icon: siAnthropic,    color: `#${siAnthropic.hex}` },
  openrouter:                                   { name: "OpenRouter",    icon: null,           color: "#6366f1" },
  "openrouter/free":                            { name: "OpenRouter",    icon: null,           color: "#6366f1" },
  pollinations:                                 { name: "Pollinations",  icon: null,           color: "#10b981" },
};

function getLLM(entity: string): LLMInfo {
  return LLM_REGISTRY[entity] ?? { name: entity, icon: null, color: "#6b7280" };
}

function LLMBadge({ entity }: { entity: string }) {
  const llm = getLLM(entity);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "3px 8px 3px 6px",
        borderRadius: 99,
        border: `1px solid ${llm.color}40`,
        background: `${llm.color}18`,
        flexShrink: 0,
      }}
    >
      {llm.icon ? (
        <svg style={{ width: 12, height: 12, flexShrink: 0 }} viewBox="0 0 24 24" fill={llm.color}>
          <path d={llm.icon.path} />
        </svg>
      ) : (
        <span style={{ width: 10, height: 10, borderRadius: 3, background: llm.color, display: "inline-block", flexShrink: 0 }} />
      )}
      <span style={{ fontSize: 10, fontWeight: 600, color: llm.color, lineHeight: 1 }}>{llm.name}</span>
    </motion.div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 13, height: 13, borderRadius: "50%", flexShrink: 0,
      border: "1.5px solid #e5e7eb",
      borderTopColor: "#3b82f6",
      animation: "rap-spin 0.8s linear infinite",
    }} />
  );
}

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
        if (idx >= 0) { const u = [...prev]; u[idx] = data; return u; }
        return [...prev, data];
      });
      if (data.status === "running") setCurrentStep(data.step);
    };
    const handleComplete = (data: { jobId: string }) => {
      if (data.jobId === jobId) { setIsComplete(true); setCurrentStep(0); }
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
    <>
      <style>{`@keyframes rap-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        width: 288, background: "#0d1117",
        border: "1px solid #30363d",
        borderTop: "1px solid #3b82f640",
        borderRadius: 12,
        overflow: "hidden", fontFamily: "inherit",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", borderBottom: "1px solid #21262d",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: "#1e3a5f",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg style={{ width: 15, height: 15 }} fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#f3f4f6", lineHeight: 1.2 }}>Research agent</div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2, lineHeight: 1 }}>
              {isComplete ? "Complete" : currentStep > 0 ? `Step ${currentStep} of 5 — ${STEP_CONFIG[currentStep]?.name}` : "Initialising…"}
            </div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ padding: "6px 0" }}>
          {[1, 2, 3, 4, 5].map((num, i) => {
            const step = steps.find((s) => s.step === num);
            const cfg = STEP_CONFIG[num];
            const isDone = step?.status === "complete";
            const isActive = step?.status === "running";
            const isPending = !step;
            const isLast = i === 4;
            const entity = step?.tool ?? step?.model ?? step?.provider ?? "";

            return (
              <motion.div
                key={num}
                initial={false}
                animate={{ opacity: isPending ? 0.3 : 1 }}
                transition={{ duration: 0.2 }}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 14px", background: isActive ? "rgba(59,130,246,0.06)" : "transparent", borderRadius: 8, margin: "0 4px", transition: "background 0.2s" }}
              >
                {/* Step number + connector */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, marginTop: 2 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700,
                    background: isDone ? "#052e16" : isActive ? "#1e3a5f" : "#1f2937",
                    color: isDone ? "#4ade80" : isActive ? "#60a5fa" : "#6b7280",
                    transition: "background 0.2s, color 0.2s",
                  }}>
                    {isDone ? (
                      <svg style={{ width: 10, height: 10 }} viewBox="0 0 12 12" fill="none" stroke="#4ade80" strokeWidth={2}>
                        <polyline points="2,6 5,9 10,3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : num}
                  </div>
                  {!isLast && (
                    <div style={{
                      width: 1, minHeight: 14, marginTop: 3, flexGrow: 1,
                      background: isDone ? "#14532d" : "#1f2937",
                      transition: "background 0.4s",
                    }} />
                  )}
                </div>

                {/* Text + badge */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, paddingBottom: 2 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 500, lineHeight: 1.3,
                      color: isDone ? "#4b5563" : isActive ? "#f9fafb" : "#4b5563",
                      transition: "color 0.2s",
                    }}>
                      {cfg.name}
                    </div>
                    <AnimatePresence mode="wait">
                      {(isActive || isDone) && (
                        <motion.div
                          key={step?.status}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ fontSize: 10, color: "#6b7280", marginTop: 2, lineHeight: 1.4 }}
                        >
                          {isActive ? cfg.running : cfg.done}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginTop: 2 }}>
                    <AnimatePresence>
                      {isDone && entity && <LLMBadge entity={entity} />}
                    </AnimatePresence>
                    {isActive && <Spinner />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Done bar */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              style={{
                borderTop: "1px solid #1f2937",
                background: "#052e16",
                padding: "8px 14px",
                display: "flex", alignItems: "center", gap: 7,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 500, color: "#4ade80" }}>Research complete</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}