// src/components/chat/MentionDropdown.tsx
import { ALL_AGENTS } from "./AgentConfig";

interface MentionDropdownProps {
  query: string;
  onSelect: (agentName: string) => void;
  position: { top: number; left: number };
}

export function MentionDropdown({ query, onSelect, position }: MentionDropdownProps) {
  const filtered = ALL_AGENTS.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  if (filtered.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        zIndex: 100,
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "6px 0",
        minWidth: 280,
        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      }}
    >
      <div style={{ padding: "4px 12px 8px", fontSize: "0.7rem", color: "var(--text-3)", fontWeight: 600 }}>
        AI Agents
      </div>
      {filtered.map((agent) => (
        <button
          key={agent.name}
          onClick={() => onSelect(agent.name)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "8px 12px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--bg-3)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: agent.bg,
              border: `1px solid ${agent.borderColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              color: agent.color,
              flexShrink: 0,
            }}
          >
            {agent.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text)" }}>
              @{agent.name}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {agent.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}