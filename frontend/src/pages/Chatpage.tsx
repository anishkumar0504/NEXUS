import { useEffect, useRef, useState } from "react";
import { useGroupChat } from "../hooks/useGroupChat"; 
import type { GroupMessage, GroupMember } from "../lib/groupchat";

// ── Tiny helpers ─────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Color bucket for user avatars — deterministic from userId */
const AVATAR_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#22c55e", // green
  "#3b82f6", // blue
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  userId?: string;
  isAgent?: boolean;
  size?: number;
}

function Avatar({ name, avatarUrl, userId, isAgent, size = 32 }: AvatarProps) {
  const bg = isAgent
    ? "rgba(99,102,241,0.18)"
    : userId
    ? avatarColor(userId)
    : "#444";

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
    color: isAgent ? "var(--accent-2)" : "#fff",
    background: bg,
    border: isAgent ? "1px solid rgba(99,102,241,0.35)" : "none",
    overflow: "hidden",
  };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ ...style, objectFit: "cover" }}
      />
    );
  }

  // Agent icon: a small ⬡ hex, user: initials
  return (
    <div style={style}>
      {isAgent ? "⬡" : initials(name)}
    </div>
  );
}

interface MessageBubbleProps {
  msg: GroupMessage;
  isSelf: boolean;
  showAvatar: boolean;
}

function MessageBubble({ msg, isSelf, showAvatar }: MessageBubbleProps) {
  const isAgent = msg.senderType === "AGENT";
  const senderName = isAgent
    ? `@${msg.agent?.name ?? "agent"}`
    : msg.user?.name ?? "Unknown";

  const isError = isAgent && msg.content.startsWith("Agent @");

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
      {/* Avatar column — always reserve space to keep bubbles aligned */}
      <div style={{ width: 32, flexShrink: 0 }}>
        {showAvatar && (
          <Avatar
            name={senderName}
            avatarUrl={msg.user?.provider === "Google" ? undefined : undefined}
            userId={msg.userId ?? msg.agentId ?? "agent"}
            isAgent={isAgent}
            size={32}
          />
        )}
      </div>

      {/* Bubble + meta */}
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
              color: isAgent ? "var(--accent-2)" : "var(--text-3)",
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
              ? "rgba(99,102,241,0.10)"
              : "var(--bg-3)",
            border: isError
              ? "1px solid rgba(239,68,68,0.25)"
              : isAgent
              ? "1px solid rgba(99,102,241,0.2)"
              : isSelf
              ? "none"
              : "1px solid var(--border)",
            borderRadius: isSelf
              ? "14px 14px 4px 14px"
              : "14px 14px 14px 4px",
            padding: "9px 13px",
            color: isError
              ? "var(--red)"
              : isSelf
              ? "#fff"
              : "var(--text)",
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

/** Glowing dots while an agent thinks */
function AgentThinking() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 2 }}>
      <Avatar name="agent" isAgent size={32} />
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

// ── Main ChatPage ─────────────────────────────────────────────────────────────

interface ChatPageProps {
  groupChatId: string | null;
  token: string | null;
  currentUserId: string | null;
  onBack?: () => void; // mobile back
}

export function ChatPage({ groupChatId, token, currentUserId, onBack }: ChatPageProps) {
  const { chat, messages, loading, sending, error, connected, sendMessage, copyInviteLink, inviteCopied } =
    useGroupChat(groupChatId, token);

  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages or when agent is thinking
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }

  function handleSend() {
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group consecutive messages by same sender
  function shouldShowAvatar(idx: number): boolean {
    if (idx === messages.length - 1) return true;
    const curr = messages[idx];
    const next = messages[idx + 1];
    return (curr.userId ?? curr.agentId) !== (next.userId ?? next.agentId);
  }

  // ── Empty state ──────────────────────────────────────────────
  if (!groupChatId) {
    return (
      <div className="chat-empty-state">
        <span style={{ fontSize: "2.2rem", color: "var(--accent)", marginBottom: 12 }}>⬡</span>
        <p style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>
          Select a group chat or create one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="chat-page">
      {/* ─ Header ────────────────────────────────────────────── */}
      <header className="chat-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onBack && (
            <button className="chat-back-btn" onClick={onBack} aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <div>
            <h2 className="chat-title">{loading ? "Loading…" : (chat?.name ?? "Group Chat")}</h2>
            <div className="chat-meta">
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: connected ? "var(--green)" : "var(--text-3)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span>{connected ? "Live" : "Connecting…"}</span>
              {chat && (
                <>
                  <span style={{ color: "var(--border-2)" }}>·</span>
                  <span>{chat.members?.length ?? 0} members</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Member avatars + invite */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {chat?.members && chat.members.length > 0 && (
            <div className="chat-member-stack">
              {chat.members.slice(0, 4).map((m: GroupMember, i: number) => (
                <div
                  key={m.id}
                  title={m.user.name}
                  style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 4 - i }}
                >
                  <Avatar name={m.user.name} userId={m.id} size={28} />
                </div>
              ))}
              {chat.members.length > 4 && (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--bg-4)",
                    border: "1px solid var(--border)",
                    color: "var(--text-3)",
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: -8,
                  }}
                >
                  +{chat.members.length - 4}
                </div>
              )}
            </div>
          )}

          <button className="invite-btn" onClick={copyInviteLink} title="Copy invite link">
            {inviteCopied ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="14" height="14">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="14" height="14">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Invite
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Message list ──────────────────────────────────────── */}
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
              Use @summarizer or @imagegen to invoke AI agents.
            </p>
          </div>
        )}

        {!loading &&
          messages.map((msg: GroupMessage, idx: number) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isSelf={msg.userId === currentUserId}
              showAvatar={shouldShowAvatar(idx)}
            />
          ))}

        {/* ✅ FIXED: Using 'sending' from hook instead of undefined 'agentThinking' */}
        {sending && <AgentThinking />}
        
        <div ref={bottomRef} />
      </div>

      {/* ── Input ─────────────────────────────────────────────── */}
      <div className="chat-input-bar">
        <div className="chat-searchbar">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Message the group… (use @agentname to invoke AI)"
            value={draft}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!connected}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!draft.trim() || !connected}
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="chat-input-hint">Enter to send · Shift+Enter for new line</p>
      </div>

      {/* Inline bounce keyframes — matches Nexus's existing style */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}