// src/components/chat/PlanCard.tsx
import { useState } from "react";
import { Avatar } from "./Avatar";
import { getAgentConfig } from "./AgentConfig";
import type { GroupMessage } from "../../lib/groupchat";

interface PlanCardProps {
  msg: GroupMessage;
  currentUserId: string | null;
  onSelectOption: (option: string) => void;
  onSendCustom?: (text: string) => void;
}

export function PlanCard({ msg, currentUserId, onSelectOption, onSendCustom }: PlanCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const agentConfig = getAgentConfig(msg.agent?.name);

  // Parse plan content
  const lines = msg.content.split("\n");
  const bodyLines: string[] = [];
  const options: string[] = [];

  let inOptions = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("○") || line.startsWith("•") || line.startsWith("-")) {
      inOptions = true;
      const optText = line.replace(/^[○•-]\s*/, "");
      if (optText.toLowerCase().includes("something else")) {
        options.push("__custom__");
      } else {
        options.push(optText);
      }
    } else if (!inOptions && line) {
      bodyLines.push(lines[i]);
    }
  }

  // Check if this plan belongs to current user
  const isMyPlan = msg.triggeringUserId === currentUserId;
  const isAnswered = selected !== null;

  function handleSelect(opt: string) {
    if (isAnswered || !isMyPlan) return;
    setSelected(opt);
    if (opt === "__custom__") {
      setShowCustom(true);
    } else {
      onSelectOption(`I choose: ${opt}`);
    }
  }

  function handleCustomSubmit() {
    if (!customText.trim()) return;
    setSelected(customText);
    onSendCustom?.(`Something else: ${customText}`);
  }

  function handleSkip() {
    if (isAnswered || !isMyPlan) return;
    setSelected("skip");
    onSelectOption("Proceed with your plan.");
  }

  // Read-only view for other users
  if (!isMyPlan) {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
        <div style={{
          maxWidth: "min(90%, 520px)",
          width: "100%",
          background: agentConfig.bg,
          border: `1px solid ${agentConfig.borderColor}`,
          borderRadius: 16,
          padding: "16px 20px",
          opacity: 0.6,
        }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-3)", marginBottom: 8 }}>
            {msg.agent?.name || "Nexus"} asked a question...
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text)" }}>
            {bodyLines.map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </div>
      </div>
    );
  }

  // Interactive view for the user who asked
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
      <div style={{
        maxWidth: "min(90%, 520px)",
        width: "100%",
        background: agentConfig.bg,
        border: `1px solid ${agentConfig.borderColor}`,
        borderRadius: 16,
        padding: "16px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Avatar name={msg.agent?.name || "nexus"} agentName={msg.agent?.name} isAgent size={24} />
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: agentConfig.color }}>
            {msg.agent?.name || "Nexus"}
          </span>
          <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>is planning...</span>
        </div>

        <div style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.6, marginBottom: 12 }}>
          {bodyLines.map((line, i) => <p key={i} style={{ margin: "4px 0" }}>{line}</p>)}
        </div>

        {!isAnswered && !showCustom && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleSelect(opt)}
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
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = agentConfig.bg; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
              >
                {opt === "__custom__" ? "○ Something else (write your own)" : `○ ${opt}`}
              </button>
            ))}
            <button
              onClick={handleSkip}
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

        {showCustom && !isAnswered && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              type="text"
              placeholder="Type your own approach..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: `1px solid ${agentConfig.borderColor}`,
                background: "var(--bg-2)",
                color: "var(--text)",
                fontSize: "0.85rem",
              }}
              autoFocus
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customText.trim()}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "none",
                background: agentConfig.color,
                color: "#fff",
                fontSize: "0.85rem",
                cursor: customText.trim() ? "pointer" : "not-allowed",
                opacity: customText.trim() ? 1 : 0.5,
              }}
            >
              Submit
            </button>
            <button
              onClick={() => { setShowCustom(false); setSelected(null); }}
              style={{
                textAlign: "center",
                padding: "4px",
                border: "none",
                background: "transparent",
                color: "var(--text-3)",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              Back to options
            </button>
          </div>
        )}

        {isAnswered && (
          <div style={{
            padding: "8px 12px",
            borderRadius: 10,
            background: "var(--bg-3)",
            color: "var(--text-3)",
            fontSize: "0.8rem",
            textAlign: "center",
          }}>
            {selected === "skip" ? "Skipped — proceeding..." : `Selected: ${selected}`}
          </div>
        )}

        <span style={{ fontSize: "0.65rem", color: "var(--text-3)", display: "block", marginTop: 8 }}>
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}