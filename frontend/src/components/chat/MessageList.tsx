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
  onSendMessage?: (content: string) => void; // <-- ADD THIS
}

function shouldShowAvatar(messages: GroupMessage[], idx: number): boolean {
  const curr = messages[idx];
  if (curr.senderType === "SYSTEM") return false;
  if (idx === messages.length - 1) return true;
  const next = messages[idx + 1];
  if (next.senderType === "SYSTEM") return true;
  return (curr.userId ?? curr.agentId) !== (next.userId ?? next.agentId);
}

// Source card for research citations
function SourceCard({ source, index }: { source: { title: string; url: string }; index: number }) {
  let hostname = "";
  try {
    hostname = new URL(source.url).hostname.replace("www.", "");
  } catch {
    hostname = source.url;
  }

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="source-card"
    >
      <span className="source-index">{index + 1}</span>
      <div className="source-info">
        <span className="source-title">{source.title || hostname}</span>
        <span className="source-host">{hostname}</span>
      </div>
      <svg className="source-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

export function MessageList({
  messages,
  loading,
  error,
  currentUserId,
  agentThinking,
  activeAgentName,
  onSelectPlanOption,
  onSendMessage, // <-- ADD THIS
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
            Use @nexus, @summarizer, @imagegen, or @research to invoke AI agents.
          </p>
        </div>
      )}

      {!loading &&
        messages.map((msg: GroupMessage, idx: number) => {
          const isPlan = msg.senderType === "AGENT" && msg.content.includes("○");
          const hasImage = msg.senderType === "AGENT" && !!msg.sources?.image;
          const isResearch = msg.agent?.name === "research";

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

              {/* Research-specific rendering */}
              {isResearch && msg.sources && (
                <div className={`research-wrapper ${msg.userId === currentUserId ? "self" : "other"}`}>
                  
                  {/* Citations */}
                  {msg.sources.citations && msg.sources.citations.length > 0 && (
                    <div className="research-section">
                      <div className="research-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        Sources
                      </div>
                      <div className="sources-grid">
                        {msg.sources.citations.map((s, i) => (
                          <SourceCard key={i} source={s} index={i} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mind Map Image */}
                  {msg.sources.mindMapImage && (
                    <div className="research-section">
                      <div className="research-label">Research Map</div>
                      <img
                        src={msg.sources.mindMapImage}
                        alt="Research visualization"
                        className="mind-map-image"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {/* Follow-up Questions */}
                  {msg.sources.followUpQuestions && msg.sources.followUpQuestions.length > 0 && onSendMessage && (
                    <div className="research-section">
                      <div className="research-label">Explore Further</div>
                      <div className="followups-list">
                        {msg.sources.followUpQuestions.map((q, i) => (
                          <button
                            key={i}
                            className="followup-btn"
                            onClick={() => onSendMessage(`@research ${q}`)}
                          >
                            <span className="followup-arrow">→</span>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Regular image rendering (for @imagegen) */}
              {hasImage && msg.sources?.image && !isResearch && (
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
        .image-wrapper, .research-wrapper {
          display: flex;
          margin-top: 4px;
        }
        .image-wrapper.self, .research-wrapper.self {
          justify-content: flex-end;
        }
        .image-wrapper.other, .research-wrapper.other {
          justify-content: flex-start;
          margin-left: 44px;
        }
        .generated-image {
          max-width: 320px;
          max-height: 320px;
          border-radius: 12px;
          border: 1px solid var(--border);
        }
        .mind-map-image {
          max-width: 100%;
          max-height: 400px;
          border-radius: 12px;
          border: 1px solid var(--border);
        }
        .research-section {
          background: var(--surface-2);
          border-radius: 12px;
          padding: 12px;
          margin-top: 8px;
          max-width: 600px;
        }
        .research-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-3);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .sources-grid {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .source-card {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: var(--surface-3);
          border-radius: 8px;
          text-decoration: none;
          color: inherit;
          transition: background 0.15s;
        }
        .source-card:hover {
          background: var(--bg-3);
        }
        .source-index {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--accent);
          color: white;
          font-size: 0.7rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .source-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .source-title {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .source-host {
          font-size: 0.7rem;
          color: var(--text-3);
        }
        .source-arrow {
          color: var(--text-3);
          flex-shrink: 0;
        }
        .followups-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .followup-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--surface-3);
          border: none;
          border-radius: 8px;
          color: var(--text);
          font-size: 0.82rem;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s;
        }
        .followup-btn:hover {
          background: var(--accent);
          color: white;
        }
        .followup-arrow {
          color: var(--accent);
          font-weight: 600;
        }
        .followup-btn:hover .followup-arrow {
          color: white;
        }
      `}</style>
    </div>
  );
}