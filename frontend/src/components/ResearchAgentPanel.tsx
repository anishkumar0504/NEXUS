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
  Xai,
  // @ts-ignore — some icons might need custom handling
} from "@lobehub/icons";

interface ResearchStep {
  step: number;
  status: "running" | "complete" | "error";
  tool?: string;
  model?: string;
  provider?: string;
  label?: string;
}

const STEP_CONFIG: Record<number, { name: string; color: string }> = {
  1: { name: "Search", color: "#3b82f6" },
  2: { name: "Extract", color: "#f59e0b" },
  3: { name: "Synthesize", color: "#8b5cf6" },
  4: { name: "Follow-ups", color: "#ec4899" },
  5: { name: "Visualize", color: "#10b981" },
};

// Logo component mapping
const LOGO_COMPONENTS: Record<string, { 
  name: string; 
  component: React.FC<{ size?: number }>; 
  color: string 
}> = {
  // Search
  "tavily": {
    name: "Tavily",
    component: () => (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <circle cx="11" cy="11" r="8" stroke="#3b82f6" strokeWidth="2"/>
        <path d="M21 21l-4.35-4.35" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    color: "#3b82f6",
  },
  
  // OpenRouter
  "openrouter": {
    name: "OpenRouter",
    component: OpenRouter,
    color: "#6366f1",
  },
  "openrouter/free": {
    name: "OpenRouter",
    component: OpenRouter,
    color: "#6366f1",
  },
  
  // Meta / Llama
  "meta-llama/llama-4-scout": {
    name: "Llama 4",
    component: Meta,
    color: "#0ea5e9",
  },
  "meta-llama/llama-4-maverick": {
    name: "Llama 4",
    component: Meta,
    color: "#0284c7",
  },
  "llama-3.1-8b-instant": {
    name: "Llama 3.1",
    component: Meta,
    color: "#0ea5e9",
  },
  "llama-3.3-70b-versatile": {
    name: "Llama 3.3",
    component: Meta,
    color: "#0369a1",
  },
  
  // DeepSeek
  "deepseek/deepseek-chat-v3-0324": {
    name: "DeepSeek",
    component: DeepSeek,
    color: "#4f46e5",
  },
  "deepseek/deepseek-r1": {
    name: "DeepSeek R1",
    component: DeepSeek,
    color: "#3730a3",
  },
  
  // Google (Gemma)
  "google/gemma-3-27b-it": {
    name: "Gemma",
    component: Google,
    color: "#4285f4",
  },
  
  // NVIDIA
  "nvidia/nemotron-3-super": {
    name: "Nemotron",
    component: Nvidia,
    color: "#76b900",
  },
  "nvidia/nemotron-3-ultra": {
    name: "Nemotron Ultra",
    component: Nvidia,
    color: "#5a8a00",
  },
  
  // Mistral
  "mistralai/mistral-small-3.1-24b-instruct": {
    name: "Mistral",
    component: Mistral,
    color: "#f97316",
  },
  
  // xAI / Grok
  "x-ai/grok-3-mini-beta": {
    name: "Grok",
    component: Xai,
    color: "#000000",
  },
  
  // Groq
  "groq": {
    name: "Groq",
    component: Groq,
    color: "#f97316",
  },
  
  // Pollinations (custom)
  "pollinations": {
    name: "Pollinations",
    component: () => (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#10b981" opacity="0.2"/>
        <path d="M12 6v6l4 2" stroke="#10b981" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    color: "#10b981",
  },
  
  // OpenAI
  "openai/gpt-oss-20b": {
    name: "GPT-OSS",
    component: OpenAI,
    color: "#10a37f",
  },
};

const FALLBACK_LOGO = {
  name: "AI",
  component: () => (
    <div className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center">
      <span className="text-[8px] text-white font-bold">AI</span>
    </div>
  ),
  color: "#6366f1",
};

function getLogoInfo(entity: string) {
  return LOGO_COMPONENTS[entity] || FALLBACK_LOGO;
}

// ============================================================================
// LOGO BADGE COMPONENT
// ============================================================================

function ModelBadge({ entity }: { entity: string }) {
  const logoInfo = getLogoInfo(entity);
  const LogoComponent = logoInfo.component;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md shrink-0"
      style={{
        backgroundColor: logoInfo.color + "15",
        border: `1px solid ${logoInfo.color}30`,
      }}
    >
      <div style={{ color: logoInfo.color }}>
        <LogoComponent size={16} />
      </div>
      <span 
        className="text-[10px] font-semibold whitespace-nowrap"
        style={{ color: logoInfo.color }}
      >
        {logoInfo.name}
      </span>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ResearchAgentPanel({ jobId }: { jobId: string }) {
  const [steps, setSteps] = useState<ResearchStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    socket.on("research:step", (data: ResearchStep & { jobId: string }) => {
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
    });

    socket.on("research:complete", (data: { jobId: string }) => {
      if (data.jobId === jobId) {
        setIsComplete(true);
        setCurrentStep(0);
      }
    });

    return () => {
      socket.off("research:step");
      socket.off("research:complete");
    };
  }, [jobId]);

  return (
    <div className="research-agent-panel bg-gray-900/95 backdrop-blur rounded-xl p-4 mb-4 border border-gray-700/50 shadow-2xl max-w-md">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-700/50">
        <div className="relative">
          <motion.div
            animate={!isComplete ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 3, repeat: isComplete ? 0 : Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </motion.div>
          {!isComplete && (
            <motion.div
              className="absolute inset-0 rounded-xl bg-blue-500/30"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>
        <div>
          <h3 className="text-white font-bold text-sm">Research Agent</h3>
          <p className="text-gray-400 text-xs">
            {isComplete 
              ? "Analysis complete" 
              : `Running step ${currentStep} of 5...`
            }
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2 relative">
        {/* Vertical connector line */}
        <div className="absolute left-5 top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-500/30 via-purple-500/30 to-green-500/30" />

        {[1, 2, 3, 4, 5].map((stepNum) => {
          const step = steps.find((s) => s.step === stepNum);
          const config = STEP_CONFIG[stepNum];
          const isActive = currentStep === stepNum && !isComplete;
          const isDone = step?.status === "complete" || (isComplete && step?.status === "complete");
          const isPending = !step && !isActive;

          const entity = step?.tool || step?.model || step?.provider || "openrouter";

          if (isPending) {
            return (
              <div key={stepNum} className="flex items-center gap-3 py-2 px-3 opacity-30">
                <div className="w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center text-xs z-10">
                  {stepNum}
                </div>
                <div className="flex-1">
                  <div className="text-gray-500 text-xs">{config.name}</div>
                </div>
              </div>
            );
          }

          return (
            <motion.div
              key={stepNum}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all ${
                isActive 
                  ? "bg-gray-800/80 border border-gray-600/50 shadow-lg" 
                  : isDone 
                    ? "bg-gray-800/30" 
                    : ""
              }`}
            >
              {/* Step number / check */}
              <div 
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold z-10 shrink-0"
                style={{ 
                  backgroundColor: isActive ? config.color + "30" : isDone ? "#10b98120" : "#374151",
                  color: isActive ? config.color : isDone ? "#10b981" : "#9ca3af",
                  border: isActive ? `1px solid ${config.color}50` : "1px solid transparent",
                }}
              >
                {isDone ? "✓" : stepNum}
              </div>

              {/* Step name */}
              <div className="flex-1 min-w-0">
                <div className="text-gray-200 text-xs font-medium">{config.name}</div>
                <div className="text-gray-500 text-[10px] truncate">
                  {step?.label || (isActive ? "Processing..." : "Complete")}
                </div>
              </div>

              {/* Model logo badge */}
              {step && <ModelBadge entity={entity} />}

              {/* Spinner for active step */}
              {isActive && (
                <motion.div
                  className="w-4 h-4 border-2 rounded-full shrink-0"
                  style={{ 
                    borderColor: config.color + "40", 
                    borderTopColor: config.color 
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Completion indicator */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 pt-3 border-t border-gray-700/50 flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">All systems complete</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}