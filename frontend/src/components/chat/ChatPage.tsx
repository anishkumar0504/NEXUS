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
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number; placement: "above" | "below" }>({ top: 0, left: 0, placement: "above" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateMentionQuery = useCallback(() => {
    const ta = textareaRef.current;
    const container = containerRef.current;
    if (!ta || !container) return;

    const text = ta.value;
    const cursorPos = ta.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);

    const lastAt = textBeforeCursor.lastIndexOf("@");
    if (lastAt === -1) {
      setMentionQuery(null);
      return;
    }

    const afterAt = textBeforeCursor.slice(lastAt + 1);
    if (afterAt.includes(" ")) {
      setMentionQuery(null);
      return;
    }

    // Get cursor coordinates relative to viewport
    const rect = ta.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Create a mirror element to measure exact cursor position
    const mirror = document.createElement("div");
    const computed = window.getComputedStyle(ta);
    mirror.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      visibility: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-wrap: break-word;
      width: ${rect.width}px;
      padding: ${computed.padding};
      border: ${computed.border};
      font: ${computed.font};
      line-height: ${computed.lineHeight};
      letter-spacing: ${computed.letterSpacing};
    `;
    mirror.textContent = textBeforeCursor;
    const span = document.createElement("span");
    span.textContent = "\u200b"; // zero-width space to mark cursor
    mirror.appendChild(span);
    document.body.appendChild(mirror);

    const spanRect = span.getBoundingClientRect();
    document.body.removeChild(mirror);

    // Calculate position relative to container
    const cursorX = spanRect.left - containerRect.left;
    const cursorY = spanRect.top - containerRect.top;
    const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2;

    const dropdownHeight = 220;
    const dropdownWidth = 280;
    const gap = 8;

    // Check if there's room above; if not, place below
    const spaceAbove = cursorY;
    const spaceBelow = containerRect.height - cursorY - lineHeight;
    const placement = spaceAbove >= dropdownHeight + gap || spaceAbove > spaceBelow ? "above" : "below";

    // Clamp left position so dropdown doesn't overflow container
    let left = cursorX;
    if (left + dropdownWidth > containerRect.width) {
      left = containerRect.width - dropdownWidth - 8;
    }
    if (left < 8) left = 8;

    setMentionPos({
      top: placement === "above" ? cursorY - dropdownHeight - gap : cursorY + lineHeight + gap,
      left,
      placement,
    });

    setMentionQuery(afterAt);
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
      if (mentionQuery !== null) return;
      handleSend();
    }
    if (e.key === "Escape") {
      setMentionQuery(null);
    }
  }

  function handleSend() {
    if (!draft.trim() || sending) return;
    onSend(draft);
    setDraft("");
    setMentionQuery(null);
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

    setTimeout(() => {
      ta.focus();
      const newCursorPos = lastAt + agentName.length + 2;
      ta.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMentionQuery(null);
      }
    }
    if (mentionQuery !== null) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [mentionQuery]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {mentionQuery !== null && (
        <MentionDropdown
          query={mentionQuery}
          onSelect={handleMentionSelect}
          position={mentionPos}
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