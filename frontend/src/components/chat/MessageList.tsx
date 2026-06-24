// src/components/chat/MessageList.tsx
import { useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
import { AgentThinking } from "./AgentThinking";
import type { GroupMessage } from "../../lib/groupchat";
import { PlanCard } from "./PlanCard";

interface MessageListProps {
  messages: GroupMessage[];
  loading: boolean;
  error: string | null;
  currentUserId: string | null;
  agentThinking: boolean;
  activeAgentName?: string;
  onSelectPlanOption?: (option: string) => void;
}

function shouldShowAvatar(messages: GroupMessage[], idx: number): boolean {
  const curr = messages[idx];
  if (curr.senderType === "SYSTEM") return false;
  if (idx === messages.length - 1) return true;
  const next = messages[idx + 1];
  if (next.senderType === "SYSTEM") return true;
  return (curr.userId ?? curr.agentId) !== (next.userId ?? next.agentId);
}

export function MessageList({
  messages,
  loading,
  error,
  currentUserId,
  agentThinking,
  activeAgentName,
  onSelectPlanOption,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentThinking]);

  return (
    <div className="chat-messages">
      {loading && (
        <div className="chat-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`chat-skeleton chat-skeleton--${i % 2 === 0 ? "right" : "left"}`} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="chat-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {!loading && !error && messages.length === 0 && (
        <div className="chat-no-messages">
          <span style={{ fontSize: "1.8rem" }}>💬</span>
          <p>No messages yet. Say something!</p>
          <p style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 4 }}>
            Use @nexus, @summarizer or @imagegen to invoke AI agents.
          </p>
        </div>
      )}

      {!loading &&
        messages.map((msg: GroupMessage, idx: number) => {
          const isPlan = msg.senderType === "AGENT" && msg.content.includes("○");
          const hasImage = msg.senderType === "AGENT" && msg.sources?.image;

          if (isPlan && onSelectPlanOption) {
            return (
              <PlanCard
                key={msg.id}
                msg={msg}
                currentUserId={currentUserId}
                onSelectOption={onSelectPlanOption}
                onSendCustom={onSelectPlanOption}
              />
            );
          }

          return (
            <div key={msg.id} className="message-wrapper">
              <MessageBubble
                msg={msg}
                isSelf={msg.userId === currentUserId}
                showAvatar={shouldShowAvatar(messages, idx)}
              />
              {hasImage && (
                <div className={`image-wrapper ${msg.userId === currentUserId ? "self" : "other"}`}>
                  <img
                    src={msg.sources.image}
                    alt="AI generated"
                    className="generated-image"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

      {agentThinking && <AgentThinking agentName={activeAgentName} />}

      <div ref={bottomRef} />

      <style>{`
        .message-wrapper {
          display: flex;
          flex-direction: column;
          margin-bottom: 8px;
        }
        .image-wrapper {
          display: flex;
        }
        .image-wrapper.self {
          justify-content: flex-end;
        }
        .image-wrapper.other {
          justify-content: flex-start;
          margin-left: 44px;
        }
        .generated-image {
          max-width: 320px;
          max-height: 320px;
          border-radius: 12px;
          border: 1px solid var(--border);
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}