import { useState } from "react";
import type { Conversation } from "../lib/api";
import type { GroupChat } from "../lib/groupchat";

interface SidebarProps {
  // ── existing Nexus search props ──────────────────────────────
  conversations: Conversation[];
  loadingConversations: boolean;
  activeConversationId: string | null;
  user: {
    id?: string;
    email?: string;
    user_metadata?: { full_name?: string; avatar_url?: string };
  } | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewSearch: () => void;
  onSignOut: () => void;
  isOpen: boolean;
  onClose: () => void;

  // ── group chat props ─────────────────────────────────────────
  groupChats: GroupChat[];
  loadingGroupChats: boolean;
  activeGroupChatId: string | null;
  onSelectGroupChat: (id: string) => void;
  onDeleteGroupChat: (id: string) => void;
  onCreateGroupChat: (name: string) => Promise<void>;
  onJoinGroupChat: (inviteCode: string) => Promise<void>;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ── Small modal for create / join ────────────────────────────────────────────
interface QuickModalProps {
  mode: "create" | "join";
  onConfirm: (value: string) => Promise<void>;
  onClose: () => void;
}

function QuickModal({ mode, onConfirm, onClose }: QuickModalProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!value.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await onConfirm(value.trim());
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">
          {mode === "create" ? "New group chat" : "Join via invite code"}
        </h3>
        <input
          autoFocus
          className="modal-input"
          placeholder={mode === "create" ? "Group name…" : "Paste invite code…"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={busy}
        />
        {err && <p className="modal-error">{err}</p>}
        <div className="modal-actions">
          <button className="modal-cancel-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="modal-confirm-btn" onClick={submit} disabled={busy || !value.trim()}>
            {busy ? "…" : mode === "create" ? "Create" : "Join"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export function Sidebar({
  conversations,
  loadingConversations,
  activeConversationId,
  user,
  onSelectConversation,
  onDeleteConversation,
  onNewSearch,
  onSignOut,
  isOpen,
  onClose,
  groupChats,
  loadingGroupChats,
  activeGroupChatId,
  onSelectGroupChat,
  onDeleteGroupChat,
  onCreateGroupChat,
  onJoinGroupChat,
}: SidebarProps) {
  const name =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const avatar = user?.user_metadata?.avatar_url;
  const email = user?.email || "";

  const [groupsOpen, setGroupsOpen] = useState(true);
  const [modal, setModal] = useState<"create" | "join" | null>(null);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`sidebar-backdrop ${isOpen ? "is-visible" : ""}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${isOpen ? "is-open" : ""}`}>
        {/* ── Logo + new search ─────────────────────────────────── */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="sidebar-logo-icon">⬡</span>
            <span className="sidebar-logo-text">Nexus</span>
          </div>
          <button className="new-chat-btn" onClick={onNewSearch} title="New search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* ── Search history ────────────────────────────────────── */}
        <div className="sidebar-section-label">Recent</div>
        <div className="sidebar-conversations">
          {loadingConversations &&
            [1, 2, 3].map((i) => <div key={i} className="sidebar-skeleton" />)}

          {!loadingConversations && conversations.length === 0 && (
            <p className="sidebar-empty">No searches yet.</p>
          )}

          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`sidebar-item ${activeConversationId === conv.id ? "sidebar-item--active" : ""}`}
              onClick={() => onSelectConversation(conv.id)}
            >
              <div className="sidebar-item-content">
                <span className="sidebar-item-title">{conv.title}</span>
                <span className="sidebar-item-time">{timeAgo(conv.createdAt)}</span>
              </div>
              <button
                className="sidebar-delete-btn"
                onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                title="Delete"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* ── Group Chats section ───────────────────────────────── */}
        <div className="sidebar-group-header">
          {/* Label row with chevron */}
          <button
            className="sidebar-group-toggle"
            onClick={() => setGroupsOpen((v) => !v)}
            aria-expanded={groupsOpen}
          >
            <span className="sidebar-section-label" style={{ padding: 0, margin: 0 }}>
              Group Chats
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              width="12"
              height="12"
              style={{
                transition: "transform 0.18s ease",
                transform: groupsOpen ? "rotate(0deg)" : "rotate(-90deg)",
                color: "var(--text-3)",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Create + Join buttons */}
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="new-chat-btn"
              onClick={() => setModal("join")}
              title="Join via invite code"
              style={{ fontSize: "0.7rem", width: 28, height: 28 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
            <button
              className="new-chat-btn"
              onClick={() => setModal("create")}
              title="New group chat"
              style={{ width: 28, height: 28 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dropdown list */}
        {groupsOpen && (
          <div className="sidebar-conversations" style={{ maxHeight: 220 }}>
            {loadingGroupChats &&
              [1, 2].map((i) => <div key={i} className="sidebar-skeleton" />)}

            {!loadingGroupChats && groupChats.length === 0 && (
              <p className="sidebar-empty">No group chats yet.</p>
            )}

            {groupChats.map((gc) => (
              <div
                key={gc.id}
                className={`sidebar-item ${activeGroupChatId === gc.id ? "sidebar-item--active" : ""}`}
                onClick={() => { onSelectGroupChat(gc.id); onClose(); }}
              >
                <div className="sidebar-item-content">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* Small group icon */}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="11"
                      height="11"
                      style={{ color: "var(--accent-2)", flexShrink: 0 }}
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span className="sidebar-item-title">{gc.name}</span>
                  </div>
                  <span className="sidebar-item-time">{timeAgo(gc.createdAt)}</span>
                </div>
                <button
                  className="sidebar-delete-btn"
                  onClick={(e) => { e.stopPropagation(); onDeleteGroupChat(gc.id); }}
                  title="Leave / delete"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── User profile ──────────────────────────────────────── */}
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            {avatar ? (
              <img src={avatar} alt={name} className="sidebar-avatar" />
            ) : (
              <div className="sidebar-avatar-placeholder">
                {name[0].toUpperCase()}
              </div>
            )}
            <div className="sidebar-user-details">
              <span className="sidebar-user-name">{name}</span>
              <span className="sidebar-user-email">{email}</span>
            </div>
          </div>
          <button className="sidebar-signout-btn" onClick={onSignOut} title="Sign out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Modals ────────────────────────────────────────────── */}
      {modal === "create" && (
        <QuickModal
          mode="create"
          onConfirm={onCreateGroupChat}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "join" && (
        <QuickModal
          mode="join"
          onConfirm={onJoinGroupChat}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}