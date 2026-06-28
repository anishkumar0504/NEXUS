// components/ResearchAgentPanel.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Meta,
  OpenAI,
  Google,
  Nvidia,
  Groq,
  Mistral,
  DeepSeek,
  OpenRouter,
  XAI,
} from "@lobehub/icons";

interface ResearchStep {
  step: number;
  status: "running" | "complete" | "error";
  tool?: string;
  model?: string;
  provider?: string;
  label?: string;
}

interface ResearchAgentPanelProps {
  jobId: string;
  socket: any; // Socket from useGroupChat
}

const STEP_CONFIG: Record<number, { name: string; color: string }> = {
  1: { name: "Search", color: "#3b82f6" },
  2: { name: "Extract", color: "#f59e0b" },
  3: { name: "Synthesize", color: "#8b5cf6" },
  4: { name: "Follow-ups", color: "#ec4899" },
  5: { name: "Visualize", color: "#10b981" },
};

// Logo mapping (same as before)
const LOGO_COMPONENTS: Record<string, { name: string; component: React.FC<{ size?: number }>; color: string }> = {
  "tavily": { name: "Tavily", component: () => <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><circle cx="11" cy="11" r="8" stroke="#3b82f6" strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/></svg>, color: "#3b82f6" },
  "openrouter": { name: "OpenRouter", component: OpenRouter, color: "#6366f1" },
  "openrouter/free": { name: "OpenRouter", component: OpenRouter, color: "#6366f1" },
  "meta-llama/llama-4-scout": { name: "Llama 4", component: Meta, color: "#0ea5e9" },
  "meta-llama/llama-4-maverick": { name: "Llama 4", component: Meta, color: "#0284c7" },
  "llama-3.1-8b-instant": { name: "Llama 3.1", component: Meta, color: "#0ea5e9" },
  "llama-3.3-70b-versatile": { name: "Llama 3.3", component: Meta, color: "#0369a1" },
  "deepseek/deepseek-chat-v3-0324": { name: "DeepSeek", component: DeepSeek, color: "#4f46e5" },
  "deepseek/deepseek-r1": { name: "DeepSeek R1", component: DeepSeek, color: "#3730a3" },
  "google/gemma-3-27b-it": { name: "Gemma", component: Google, color: "#4285f4" },
  "nvidia/nemotron-3-super": { name: "Nemotron", component: Nvidia, color: "#76b900" },
  "nvidia/nemotron-3-ultra": { name: "Nemotron Ultra", component: Nvidia, color: "#5a8a00" },
  "mistralai/mistral-small-3.1-24b-instruct": { name: "Mistral", component: Mistral, color: "#f97316" },
  "x-ai/grok-3-mini-beta": { name: "Grok", component: XAI, color: "#000000" },
  "groq": { name: "Groq", component: Groq, color: "#f97316" },
  "pollinations": { name: "Pollinations", component: () => <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#10b981" opacity="0.2"/><path d="M12 6v6l4 2" stroke="#10b981" strokeWidth="2" strokeLinecap="round"/></svg>, color: "#10b981" },
  "openai/gpt-oss-20b": { name: "GPT-OSS", component: OpenAI, color: "#10a37f" },
};

const FALLBACK_LOGO = {
  name: "AI",
  component: () => <div className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center"><span className="text-[8px] text-white font-bold">AI</span></div>,
  color: "#6366f1",
};

function getLogoInfo(entity: string) {
  return LOGO_COMPONENTS[entity] || FALLBACK_LOGO;
}

function ModelBadge({ entity }: { entity: string }) {
  const logoInfo = getLogoInfo(entity);
  const LogoComponent = logoInfo.component;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md shrink-0"
      style={{ backgroundColor: logoInfo.color + "15", border: `1px solid ${logoInfo.color}30` }}
    >
      <div style={{ color: logoInfo.color }}><LogoComponent size={16} /></div>
      <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: logoInfo.color }}>{logoInfo.name}</span>
    </motion.div>
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
        const existing = prev.findIndex((s) => s.step === data.step);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = data;
          return updated;
        }
        return [...prev, data];
      });

      if (data.status === "running") {
        setCurrentStep(data.step);
      }
    };

    const handleComplete = (data: { jobId: string }) => {
      if (data.jobId === jobId) {
        setIsComplete(true);
        setCurrentStep(0);
      }
    };

    const handleError = (data: { jobId: string; error: string }) => {
      if (data.jobId === jobId) {
        setIsComplete(true);
      }
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
    <div className="bg-gray-900/95 backdrop-blur-xl rounded-xl p-4 border border-gray-700/50 shadow-2xl max-w-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-700/50">
        <div className="relative">
          <motion.div
            animate={!isComplete ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 3, repeat: isComplete ? 0 : Infinity, ease: "linear" }}
            className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </motion.div>
          {!isComplete && (
            <motion.div className="absolute inset-0 rounded-lg bg-blue-500/30" animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
          )}
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">Research Agent</h3>
          <p className="text-gray-400 text-xs">
            {isComplete ? "Analysis complete" : `Step ${currentStep} of 5...`}
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-1.5 relative">
        <div className="absolute left-[18px] top-3 bottom-3 w-px bg-gradient-to-b from-blue-500/20 via-purple-500/20 to-green-500/20" />

        {[1, 2, 3, 4, 5].map((stepNum) => {
          const step = steps.find((s) => s.step === stepNum);
          const config = STEP_CONFIG[stepNum];
          const isActive = currentStep === stepNum && !isComplete;
          const isDone = step?.status === "complete";
          const isPending = !step && !isActive;

          const entity = step?.tool || step?.model || step?.provider || "openrouter";

          if (isPending) {
            return (
              <div key={stepNum} className="flex items-center gap-3 py-1.5 px-2 opacity-25">
                <div className="w-5 h-5 rounded bg-gray-800 flex items-center justify-center text-[10px] text-gray-500 z-10">{stepNum}</div>
                <span className="text-gray-500 text-xs">{config.name}</span>
              </div>
            );
          }

          return (
            <motion.div
              key={stepNum}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-3 py-1.5 px-2 rounded-lg ${isActive ? "bg-gray-800/60 border border-gray-700/50" : ""}`}
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold z-10 shrink-0"
                style={{
                  backgroundColor: isActive ? config.color + "30" : isDone ? "#10b98120" : "#374151",
                  color: isActive ? config.color : isDone ? "#10b981" : "#9ca3af",
                  border: isActive ? `1px solid ${config.color}40` : "1px solid transparent",
                }}
              >
                {isDone ? "✓" : stepNum}
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-gray-300 text-xs font-medium">{config.name}</span>
                {step?.label && <p className="text-gray-500 text-[10px] truncate">{step.label}</p>}
              </div>

              {step && <ModelBadge entity={entity} />}

              {isActive && (
                <motion.div
                  className="w-3.5 h-3.5 border-2 rounded-full shrink-0"
                  style={{ borderColor: config.color + "40", borderTopColor: config.color }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {isComplete && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 pt-2.5 border-t border-gray-700/50 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">All systems complete</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}