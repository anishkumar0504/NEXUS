"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  socket: any;
}

const STEP_CONFIG: Record<number, { name: string; color: string }> = {
  1: { name: "Search", color: "#3b82f6" },
  2: { name: "Extract", color: "#f59e0b" },
  3: { name: "Synthesize", color: "#8b5cf6" },
  4: { name: "Follow-ups", color: "#ec4899" },
  5: { name: "Visualize", color: "#10b981" },
};

// Simple text-based badges — clean like your reference
const MODEL_BADGES: Record<string, { name: string; color: string }> = {
  "tavily": { name: "Tavily", color: "#3b82f6" },
  "duckduckgo": { name: "DuckDuckGo", color: "#de5833" },
  "openrouter": { name: "OpenRouter", color: "#6366f1" },
  "openrouter/free": { name: "OpenRouter", color: "#6366f1" },
  "meta-llama/llama-4-scout": { name: "Llama 4", color: "#0ea5e9" },
  "meta-llama/llama-4-maverick": { name: "Llama 4", color: "#0284c7" },
  "llama-3.1-8b-instant": { name: "Llama 3.1", color: "#0ea5e9" },
  "llama-3.3-70b-versatile": { name: "Llama 3.3", color: "#0369a1" },
  "deepseek/deepseek-chat-v3-0324": { name: "DeepSeek", color: "#4f46e5" },
  "deepseek/deepseek-r1": { name: "DeepSeek R1", color: "#3730a3" },
  "google/gemma-3-27b-it": { name: "Gemma", color: "#4285f4" },
  "nvidia/nemotron-3-super": { name: "Nemotron", color: "#76b900" },
  "groq": { name: "Groq", color: "#f97316" },
  "mistralai/mistral-small-3.1-24b-instruct": { name: "Mistral", color: "#f97316" },
  "pollinations": { name: "Pollinations", color: "#10b981" },
  "x-ai/grok-3-mini-beta": { name: "Grok", color: "#000000" },
  "openai/gpt-oss-20b": { name: "GPT-OSS", color: "#10a37f" },
};

const FALLBACK_BADGE = { name: "AI", color: "#6366f1" };

function getBadgeInfo(entity: string) {
  return MODEL_BADGES[entity] || FALLBACK_BADGE;
}

// Simple pill badge — like your reference image
function ModelBadge({ entity }: { entity: string }) {
  const badge = getBadgeInfo(entity);

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{
        backgroundColor: badge.color + "18",
        color: badge.color,
        border: `1px solid ${badge.color}30`,
      }}
    >
      {badge.name}
    </motion.span>
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
    <div className="bg-gray-900/95 backdrop-blur rounded-xl p-3 mb-3 border border-gray-700/50 shadow-lg max-w-xs">
      {/* Header — static, no rotation */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700/50">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-xs">Research Agent</h3>
          <p className="text-gray-400 text-[10px]">
            {isComplete ? "Complete" : `Step ${currentStep} of 5`}
          </p>
        </div>
      </div>

      {/* Steps — compact list */}
      <div className="space-y-1">
        {[1, 2, 3, 4, 5].map((stepNum) => {
          const step = steps.find((s) => s.step === stepNum);
          const config = STEP_CONFIG[stepNum];
          const isActive = currentStep === stepNum && !isComplete;
          const isDone = step?.status === "complete";
          const isPending = !step && !isActive;

          const entity = step?.tool || step?.model || step?.provider || "openrouter";

          if (isPending) {
            return (
              <div key={stepNum} className="flex items-center gap-2 py-1 opacity-30">
                <div className="w-4 h-4 rounded-sm bg-gray-800 flex items-center justify-center text-[9px] text-gray-500">
                  {stepNum}
                </div>
                <span className="text-gray-500 text-[11px]">{config.name}</span>
              </div>
            );
          }

          return (
            <motion.div
              key={stepNum}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`flex items-center gap-2 py-1 px-1.5 rounded ${isActive ? "bg-gray-800/50" : ""}`}
            >
              {/* Status dot/number */}
              <div
                className="w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold shrink-0"
                style={{
                  backgroundColor: isDone ? "#10b98120" : isActive ? config.color + "20" : "#374151",
                  color: isDone ? "#10b981" : isActive ? config.color : "#9ca3af",
                }}
              >
                {isDone ? "✓" : stepNum}
              </div>

              {/* Name */}
              <span className="text-gray-300 text-[11px] flex-1">{config.name}</span>

              {/* Model badge — small pill */}
              {step && <ModelBadge entity={entity} />}

              {/* Spinner */}
             {isActive && (
  <span className="relative flex h-2 w-2 shrink-0">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: config.color }} />
    <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: config.color }} />
  </span>
)}
            </motion.div>
          );
        })}
      </div>

      {/* Completion */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 pt-2 border-t border-gray-700/50 flex items-center gap-1.5"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-green-400 text-[10px]">Done</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}