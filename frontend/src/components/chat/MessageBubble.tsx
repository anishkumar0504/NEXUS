// src/components/chat/MessageBubble.tsx
import { Avatar } from "./Avatar";
import { getAgentConfig } from "./AgentConfig";
import type { GroupMessage } from "../../lib/groupchat";

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJoinDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

interface MessageBubbleProps {
  msg: GroupMessage;
  isSelf: boolean;
  showAvatar: boolean;
}

/** Centered pill for system events */
export function SystemMessage({ msg }: { msg: GroupMessage }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
      <span
        style={{
          fontSize: "0.72rem",
          color: "var(--text-3)",
          background: "var(--bg-3)",
          border: "1px solid var(--border)",
          borderRadius: 999,
          padding: "4px 12px",
        }}
      >
        {msg.user?.name ?? "Someone"} {msg.content} · {formatJoinDate(msg.createdAt)}
      </span>
    </div>
  );
}

/** Plan card for Claude-style planning/options */


export function MessageBubble({ msg, isSelf, showAvatar }: MessageBubbleProps) {
  if (msg.senderType === "SYSTEM") {
    return <SystemMessage msg={msg} />;
  }

  const isAgent = msg.senderType === "AGENT";
  const senderName = isAgent
    ? `@${msg.agent?.name ?? "agent"}`
    : msg.user?.name ?? "Unknown";

  const isError = isAgent && msg.content.startsWith("Agent @");
  const agentConfig = getAgentConfig(msg.agent?.name);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isSelf ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 8,
        marginBottom: 2,
      }}
    >
      <div style={{ width: 32, flexShrink: 0 }}>
        {showAvatar && (
          <Avatar
            name={senderName}
            avatarUrl={msg.user?.provider === "Google" ? undefined : undefined}
            userId={msg.userId ?? undefined}
            agentName={msg.agent?.name}
            isAgent={isAgent}
            size={32}
          />
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isSelf ? "flex-end" : "flex-start",
          maxWidth: "min(72%, 560px)",
          gap: 3,
        }}
      >
        {showAvatar && !isSelf && (
          <span
            style={{
              fontSize: "0.72rem",
              color: isAgent ? agentConfig.color : "var(--text-3)",
              fontWeight: 500,
              paddingLeft: 4,
            }}
          >
            {senderName}
          </span>
        )}

        <div
          style={{
            background: isError
              ? "rgba(239,68,68,0.08)"
              : isSelf
              ? "var(--accent)"
              : isAgent
              ? agentConfig.bg
              : "var(--bg-3)",
            border: isError
              ? "1px solid rgba(239,68,68,0.25)"
              : isAgent
              ? `1px solid ${agentConfig.borderColor}`
              : isSelf
              ? "none"
              : "1px solid var(--border)",
            borderRadius: isSelf ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            padding: "9px 13px",
            color: isError ? "var(--red)" : isSelf ? "#fff" : "var(--text)",
            fontSize: "0.9rem",
            lineHeight: 1.6,
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
          }}
        >
          {msg.content}
        </div>

        <span
          style={{
            fontSize: "0.67rem",
            color: "var(--text-3)",
            paddingLeft: isSelf ? 0 : 4,
            paddingRight: isSelf ? 4 : 0,
          }}
        >
          {formatTime(msg.createdAt)}
        </span>
      </div>
    </div>
  );
}