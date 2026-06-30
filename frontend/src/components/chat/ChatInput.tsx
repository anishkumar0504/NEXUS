// src/components/chat/ChatInput.tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { MentionDropdown } from "./MentionDropdown";

interface ChatInputProps {
  connected: boolean;
  sending: boolean;
  onSend: (content: string) => void;
}

export function ChatInput({ connected, sending, onSend }: ChatInputProps) {
  const [draft, setDraft] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);

  const updateMentionQuery = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const text = ta.value;
    const cursorPos = ta.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);

    const lastAt = textBeforeCursor.lastIndexOf("@");
    if (lastAt === -1) {
      setMentionQuery(null);
      setMentionOpen(false);
      return;
    }

    const afterAt = textBeforeCursor.slice(lastAt + 1);
    if (afterAt.includes(" ")) {
      setMentionQuery(null);
      setMentionOpen(false);
      return;
    }

    setMentionQuery(afterAt);
    setMentionOpen(true);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
    updateMentionQuery();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (mentionOpen) return;
      handleSend();
    }
    if (e.key === "Escape") {
      setMentionOpen(false);
      setMentionQuery(null);
    }
  }

  function handleSend() {
    if (!draft.trim() || sending) return;
    onSend(draft);
    setDraft("");
    setMentionQuery(null);
    setMentionOpen(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleMentionSelect(agentName: string) {
    const ta = textareaRef.current;
    if (!ta) return;

    const cursorPos = ta.selectionStart;
    const text = ta.value;
    const lastAt = text.slice(0, cursorPos).lastIndexOf("@");

    const before = text.slice(0, lastAt);
    const after = text.slice(cursorPos);
    const newText = `${before}@${agentName} ${after}`;

    setDraft(newText);
    setMentionQuery(null);
    setMentionOpen(false);

    setTimeout(() => {
      ta.focus();
      const newCursorPos = lastAt + agentName.length + 2;
      ta.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (inputBarRef.current && !inputBarRef.current.contains(event.target as Node)) {
        setMentionOpen(false);
        setMentionQuery(null);
      }
    }
    if (mentionOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [mentionOpen]);

  return (
    <div ref={inputBarRef} style={{ position: "relative" }}>
      {mentionOpen && mentionQuery !== null && (
        <MentionDropdown
          query={mentionQuery}
          onSelect={handleMentionSelect}
          inputBarRef={inputBarRef}
        />
      )}

      <div className="chat-input-bar">
        <div className="chat-searchbar">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder="Message the group… (use @agentname to invoke AI)"
            value={draft}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onClick={updateMentionQuery}
            onKeyUp={updateMentionQuery}
            rows={1}
            disabled={!connected}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!draft.trim() || !connected || sending}
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="chat-input-hint">Enter to send · Shift+Enter for new line · @ to mention agent</p>
      </div>
    </div>
  );
}