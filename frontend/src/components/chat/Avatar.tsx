// src/components/chat/Avatar.tsx
import { getAgentConfig } from "./AgentConfig";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  userId?: string;
  agentName?: string | null;
  isAgent?: boolean;
  size?: number;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6",
  "#f59e0b", "#22c55e", "#3b82f6",
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function Avatar({ name, avatarUrl, userId, agentName, isAgent, size = 32 }: AvatarProps) {
  const agentConfig = getAgentConfig(agentName);

  const bg = isAgent
    ? agentConfig.bg
    : userId
    ? avatarColor(userId)
    : "#444";

  const textColor = isAgent ? agentConfig.color : "#fff";
  const border = isAgent ? `1px solid ${agentConfig.borderColor}` : "none";

  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: size * 0.36,
    fontWeight: 600,
    fontFamily: "var(--font)",
    color: textColor,
    background: bg,
    border,
    overflow: "hidden",
  };

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} style={{ ...style, objectFit: "cover" }} />;
  }

  return <div style={style}>{isAgent ? agentConfig.icon : initials(name)}</div>;
}