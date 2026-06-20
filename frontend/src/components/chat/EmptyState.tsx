// src/components/chat/EmptyState.tsx
export function EmptyState() {
  return (
    <div className="chat-empty-state">
      <span style={{ fontSize: "2.2rem", color: "var(--accent)", marginBottom: 12 }}>⬡</span>
      <p style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>
        Select a group chat or create one to get started.
      </p>
    </div>
  );
}