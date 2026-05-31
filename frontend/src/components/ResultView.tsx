import { useEffect, useRef } from "react";
import type { Source } from "../lib/api";
import { SearchBar } from "./SearchBar";

// Add to props interface:
interface ResultViewProps {
  query: string;
  answer: string;
  sources: Source[];
  followUps: string[];
  loading: boolean;
  error: string | null;
  allMessages: ChatMessage[];   // ADD THIS
  onFollowUp: (query: string) => void;
}

// Import ChatMessage at the top:
import type { ChatMessage } from "../hooks/useSearch";
function SourceCard({ source, index }: { source: Source; index: number }) {
  let hostname = "";
  try {
    hostname = new URL(source.url).hostname.replace("www.", "");
  } catch {
    hostname = source.url;
  }

  const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="source-card"
    >
      <span className="source-index">{index + 1}</span>
      <img src={favicon} alt="" className="source-favicon" onError={(e) => (e.currentTarget.style.display = "none")} />
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

// Simple markdown-like renderer for bold, inline code, numbered lists, bullet points
function renderAnswer(text: string) {
  const lines = text.split("\n");
const elements: React.ReactElement[] = [];
  let key = 0;

  for (const line of lines) {
    if (!line.trim()) {
      elements.push(<div key={key++} className="answer-spacer" />);
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^(\d+)\.\s(.+)/);
    if (numberedMatch) {
      elements.push(
        <div key={key++} className="answer-list-item answer-list-item--numbered">
          <span className="answer-list-num">{numberedMatch[1]}.</span>
          <span>{renderInline(numberedMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^[-*•]\s(.+)/);
    if (bulletMatch) {
      elements.push(
        <div key={key++} className="answer-list-item">
          <span className="answer-bullet">▸</span>
          <span>{renderInline(bulletMatch[1])}</span>
        </div>
      );
      continue;
    }

    // Heading
    const h3Match = line.match(/^###\s(.+)/);
    if (h3Match) {
      elements.push(<h3 key={key++} className="answer-h3">{renderInline(h3Match[1])}</h3>);
      continue;
    }
    const h2Match = line.match(/^##\s(.+)/);
    if (h2Match) {
      elements.push(<h2 key={key++} className="answer-h2">{renderInline(h2Match[1])}</h2>);
      continue;
    }

    // Normal paragraph
    elements.push(<p key={key++} className="answer-p">{renderInline(line)}</p>);
  }

  return elements;
}

function renderInline(text: string): (string | React.ReactElement)[]
 {
  // Bold: **text**
  // Code: `text`
const parts: (string | React.ReactElement)[] = [];

  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let last = 0;
  let match;
  let k = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[0].startsWith("**")) {
      parts.push(<strong key={k++}>{match[2]}</strong>);
    } else {
      parts.push(<code key={k++} className="answer-code">{match[3]}</code>);
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function ResultView({
  answer,
  sources,
  loading,
  error,
    allMessages, // ADD THIS

  onFollowUp,
}: ResultViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll as answer streams in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [answer, sources]);

 // Inside ResultView, replace the return with this:
return (
  <div className="result-view">
    {/* Render full conversation thread */}
    {allMessages.map((msg, i) => (
      <div key={i}>
        {msg.role === "USER" ? (
          <div className="result-query">
            <span className="result-query-icon">⬡</span>
            <h2 className="result-query-text">{msg.content}</h2>
          </div>
        ) : (
          <div className="result-layout">
            <div className="result-main">
              {msg.sources && msg.sources.length > 0 && (
                <div className="sources-section">
                  <div className="sources-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Sources
                  </div>
                  <div className="sources-grid">
                    {msg.sources.map((s, j) => <SourceCard key={j} source={s} index={j} />)}
                  </div>
                </div>
              )}
              <div className="answer-section">
                <div className="answer-label">
                  <span className="answer-label-dot" />
                  Answer
                </div>
                <div className="answer-body">{renderAnswer(msg.content)}</div>
              </div>
              {/* Only show follow-ups on last assistant message */}
              {i === allMessages.length - 1 && msg.followUps && msg.followUps.length > 0 && !loading && (
                <div className="followups-section">
                  <div className="followups-label">Related</div>
                  <div className="followups-list">
                    {msg.followUps.map((q, j) => (
                      <button key={j} className="followup-btn" onClick={() => onFollowUp(q)}>
                        <span className="followup-arrow">→</span>{q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    ))}

    {/* Currently streaming answer */}
    {loading && (
      <div className="result-layout">
        <div className="result-main">
          <div className="answer-section">
            <div className="answer-label">
              <span className="answer-label-dot" />
              Answer
            </div>
            {!answer && (
              <div className="answer-thinking">
                <span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" />
              </div>
            )}
            {answer && (
              <div className="answer-body">
                {renderAnswer(answer)}
                <span className="answer-cursor" />
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {error && (
      <div className="answer-error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {error}
      </div>
    )}

    {/* Follow-up input — always visible when not loading */}
    {!loading && (
      <div className="followup-input-section">
        <SearchBar onSearch={onFollowUp} loading={loading} placeholder="Ask a follow-up..." />
      </div>
    )}

    <div ref={bottomRef} />
  </div>
);
}