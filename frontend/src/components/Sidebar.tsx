import type { Conversation } from "../lib/api";

interface SidebarProps {
  conversations: Conversation[];
  loading: boolean;
  activeConversationId: string | null;
  user: { email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewSearch: () => void;
  onSignOut: () => void;
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

export function Sidebar({
  conversations,
  loading,
  activeConversationId,
  user,
  onSelectConversation,
  onDeleteConversation,
  onNewSearch,
  onSignOut,
}: SidebarProps) {

  const name =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";

  const avatar = user?.user_metadata?.avatar_url;
  const email = user?.email || "";

  return (
    <aside className="sidebar">
      {/* Logo */}
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

      {/* Conversations list */}
      <div className="sidebar-section-label">Recent</div>

      <div className="sidebar-conversations">
        {loading && (
          <div className="sidebar-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sidebar-skeleton" />
            ))}
          </div>
        )}

        {!loading && conversations.length === 0 && (
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
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConversation(conv.id);
              }}
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

      {/* User profile at bottom */}
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
  );
}