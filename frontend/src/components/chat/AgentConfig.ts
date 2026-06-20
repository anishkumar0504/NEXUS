// src/components/chat/AgentConfig.ts

export interface AgentConfig {
  icon: string;
  color: string;
  bg: string;
  borderColor: string;
  label: string;
  description: string;
}

export const AGENT_CONFIG: Record<string, AgentConfig> = {
  nexus: {
    icon: "◉",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.15)",
    borderColor: "rgba(99,102,241,0.35)",
    label: "Nexus",
    description: "General AI assistant — answers questions, searches history, summarizes",
  },
  summarizer: {
    icon: "☰",
    color: "#14b8a6",
    bg: "rgba(20,184,166,0.15)",
    borderColor: "rgba(20,184,166,0.35)",
    label: "Summarizer",
    description: "Summarizes conversation history and key points",
  },
  imagegen: {
    icon: "▣",
    color: "#ec4899",
    bg: "rgba(236,72,153,0.15)",
    borderColor: "rgba(236,72,153,0.35)",
    label: "ImageGen",
    description: "Generates images from text descriptions",
  },
};

export const ALL_AGENTS = Object.entries(AGENT_CONFIG).map(([name, config]) => ({
  name,
  ...config,
}));

export function getAgentConfig(agentName?: string | null): AgentConfig {
  if (!agentName) return AGENT_CONFIG.nexus;
  return AGENT_CONFIG[agentName.toLowerCase()] || AGENT_CONFIG.nexus;
}