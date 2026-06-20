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
export function PlanCard({ msg, onSelectOption }: { msg: GroupMessage; onSelectOption?: (option: string) => void }) {
  const agentConfig = getAgentConfig(msg.agent?.name);

  const lines = msg.content.split("\n");
  const bodyLines: string[] = [];
  const options: string[] = [];

  let inOptions = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("○") || line.startsWith("•") || line.startsWith("-")) {
      inOptions = true;
      options.push(line.replace(/^[○•-]\s*/, ""));
    } else if (line.toLowerCase().includes("skip")) {
      options.push("__skip__");
    } else if (!inOptions) {
      bodyLines.push(lines[i]);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        margin: "12px 0",
      }}
    >
      <div
        style={{
          maxWidth: "min(90%, 520px)",
          width: "100%",
          background: agentConfig.bg,
          border: `1px solid ${agentConfig.borderColor}`,
          borderRadius: 16,
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Avatar name={msg.agent?.name || "nexus"} agentName={msg.agent?.name} isAgent size={24} />
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: agentConfig.color }}>
            {msg.agent?.name || "Nexus"}
          </span>
          <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>is planning...</span>
        </div>

        <div style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.6, marginBottom: 12 }}>
          {bodyLines.map((line, i) => (
            <p key={i} style={{ margin: "4px 0" }}>{line}</p>
          ))}
        </div>

        {options.length > 0 && onSelectOption && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {options.map((opt, i) => {
              if (opt === "__skip__") return null;
              return (
                <button
                  key={i}
                  onClick={() => onSelectOption(opt)}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: `1px solid ${agentConfig.borderColor}`,
                    background: "transparent",
                    color: "var(--text)",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.background = agentConfig.bg;
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.background = "transparent";
                  }}
                >
                  ○ {opt}
                </button>
              );
            })}
            <button
              onClick={() => onSelectOption("__skip__")}
              style={{
                textAlign: "center",
                padding: "6px 12px",
                borderRadius: 10,
                border: "none",
                background: "transparent",
                color: "var(--text-3)",
                fontSize: "0.78rem",
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              Skip and proceed
            </button>
          </div>
        )}

        <span style={{ fontSize: "0.65rem", color: "var(--text-3)", display: "block", marginTop: 8 }}>
          {formatTime(msg.createdAt)}
        </span>
      </div>
    </div>
  );
}

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