// src/components/chat/ChatHeader.tsx
import { Avatar } from "./Avatar";
import type { GroupChat, GroupMember } from "../../lib/groupchat";

interface ChatHeaderProps {
  chat: GroupChat | null;
  loading: boolean;
  connected: boolean;
  inviteCopied: boolean;
  onBack?: () => void;
  onCopyInvite: () => void;
}

export function ChatHeader({
  chat,
  loading,
  connected,
  inviteCopied,
  onBack,
  onCopyInvite,
}: ChatHeaderProps) {
  return (
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
          <h2 className="chat-title">{loading ? "Loading…" : chat?.name ?? "Group Chat"}</h2>
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

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {chat?.members && chat.members.length > 0 && (
          <div className="chat-member-stack">
            {chat.members.slice(0, 4).map((m: GroupMember, i: number) => (
              <div key={m.id} title={m.user.name} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 4 - i }}>
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

        <button className="invite-btn" onClick={onCopyInvite} title="Copy invite link">
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
  );
}