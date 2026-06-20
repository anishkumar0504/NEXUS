// src/components/chat/AgentThinking.tsx
import { Avatar } from "./Avatar";

interface AgentThinkingProps {
  agentName?: string;
}

export function AgentThinking({ agentName }: AgentThinkingProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 2 }}>
      <Avatar name={agentName || "agent"} agentName={agentName} isAgent size={32} />
      <div
        style={{
          background: "rgba(99,102,241,0.10)",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: "14px 14px 14px 4px",
          padding: "10px 14px",
          display: "flex",
          gap: 5,
          alignItems: "center",
        }}
      >
        {[0, 200, 400].map((delay) => (
          <span
            key={delay}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "inline-block",
              animation: `bounce 1.2s ease-in-out ${delay}ms infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}