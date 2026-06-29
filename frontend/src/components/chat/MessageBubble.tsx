// src/components/chat/MessageBubble.tsx
import ReactMarkdown from "react-markdown";
import { Avatar } from "./Avatar";
import { getAgentConfig } from "./AgentConfig";
import type { GroupMessage } from "../../lib/groupchat";

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJoinDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

interface MessageBubbleProps {
  msg: GroupMessage;
  isSelf: boolean;
  showAvatar: boolean;
}

/** Markdown renderer with chat-tailored styling */
function MarkdownContent({
  content,
  isSelf,
  isError,
  isAgent,
  agentConfig,
}: {
  content: string;
  isSelf: boolean;
  isError: boolean;
  isAgent: boolean;
  agentConfig: ReturnType<typeof getAgentConfig>;
}) {
  return (
    <ReactMarkdown
      components={{
        // Bold text
        strong: ({ children }) => (
          <strong
            className="font-semibold"
            style={{
              color: isSelf
                ? "rgba(255,255,255,0.95)"
                : isError
                ? "var(--red)"
                : isAgent
                ? agentConfig.color
                : "var(--text)",
              opacity: isSelf ? 1 : 0.9,
            }}
          >
            {children}
          </strong>
        ),
        // Italic text
        em: ({ children }) => (
          <em
            className="italic"
            style={{
              color: isSelf
                ? "rgba(255,255,255,0.85)"
                : "var(--text-2)",
            }}
          >
            {children}
          </em>
        ),
        // Inline code
        code: ({ children }) => (
          <code
            className="px-1.5 py-0.5 rounded-md text-[0.82em] font-mono"
            style={{
              background: isSelf
                ? "rgba(255,255,255,0.12)"
                : "var(--bg-3)",
              color: isSelf
                ? "#fff"
                : "var(--accent)",
              border: `1px solid ${
                isSelf
                  ? "rgba(255,255,255,0.08)"
                  : "var(--border)"
              }`,
            }}
          >
            {children}
          </code>
        ),
        // Code blocks
        pre: ({ children }) => (
          <pre
            className="p-3 rounded-xl my-2 overflow-x-auto"
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--border)",
            }}
          >
            {children}
          </pre>
        ),
        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-opacity duration-200 hover:opacity-70"
            style={{
              color: isSelf ? "#fff" : "var(--accent)",
            }}
          >
            {children}
          </a>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>
        ),
        // Headings
        h1: ({ children }) => (
          <h1 className="text-lg font-bold my-2 leading-tight">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold my-1.5 leading-tight">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold my-1 leading-tight">{children}</h3>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>
        ),
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote
            className="pl-3 py-1 my-2 border-l-2 italic"
            style={{
              borderLeftColor: isSelf
                ? "rgba(255,255,255,0.3)"
                : "var(--accent)",
              color: isSelf
                ? "rgba(255,255,255,0.7)"
                : "var(--text-2)",
            }}
          >
            {children}
          </blockquote>
        ),
        // Horizontal rule
        hr: () => (
          <hr
            className="my-3 border-0 h-px"
            style={{
              background: isSelf
                ? "rgba(255,255,255,0.15)"
                : "var(--border)",
            }}
          />
        ),
        // Tables
        table: ({ children }) => (
          <table className="w-full my-2 text-sm border-collapse">
            {children}
          </table>
        ),
        th: ({ children }) => (
          <th
            className="px-2 py-1.5 text-left font-semibold text-xs border-b"
            style={{
              borderBottomColor: "var(--border)",
              color: isSelf ? "#fff" : "var(--text-2)",
            }}
          >
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td
            className="px-2 py-1.5 border-b"
            style={{ borderBottomColor: "var(--border-2)" }}
          >
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/** Centered pill for system events */
export function SystemMessage({ msg }: { msg: GroupMessage }) {
  return (
    <div className="flex justify-center my-2.5">
      <span
        className="text-[0.72rem] font-medium rounded-full px-3 py-1"
        style={{
          color: "var(--text-3)",
          background: "var(--bg-3)",
          border: "1px solid var(--border)",
        }}
      >
        {msg.user?.name ?? "Someone"} {msg.content} · {formatJoinDate(msg.createdAt)}
      </span>
    </div>
  );
}

export function MessageBubble({ msg, isSelf, showAvatar }: MessageBubbleProps) {
  if (msg.senderType === "SYSTEM") {
    return <SystemMessage msg={msg} />;
  }

  const isAgent = msg.senderType === "AGENT";
  const senderName = isAgent
    ? `@${msg.agent?.name ?? "agent"}`
    : msg.user?.name ?? "Unknown";

  const isError = isAgent && msg.content.startsWith("Agent @");
  const agentConfig = getAgentConfig(msg.agent?.name);

  return (
    <div
      className={`flex items-end gap-2 mb-0.5 ${
        isSelf ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar column */}
      <div className="w-8 shrink-0">
        {showAvatar && (
          <Avatar
            name={senderName}
            avatarUrl={msg.user?.provider === "Google" ? undefined : undefined}
            userId={msg.userId ?? undefined}
            agentName={msg.agent?.name}
            isAgent={isAgent}
            size={32}
          />
        )}
      </div>

      {/* Content column */}
      <div
        className={`flex flex-col max-w-[min(72%,560px)] gap-0.5 ${
          isSelf ? "items-end" : "items-start"
        }`}
      >
        {/* Sender name */}
        {showAvatar && !isSelf && (
          <span
            className="text-[0.72rem] font-medium pl-1"
            style={{
              color: isAgent ? agentConfig.color : "var(--text-3)",
            }}
          >
            {senderName}
          </span>
        )}

        {/* Message bubble */}
        <div
          className="text-[0.9rem] leading-relaxed break-words whitespace-pre-wrap px-3.5 py-2"
          style={{
            background: isError
              ? "rgba(239,68,68,0.08)"
              : isSelf
              ? "var(--accent)"
              : isAgent
              ? agentConfig.bg
              : "var(--bg-3)",
            border: isError
              ? "1px solid rgba(239,68,68,0.25)"
              : isAgent
              ? `1px solid ${agentConfig.borderColor}`
              : isSelf
              ? "none"
              : "1px solid var(--border)",
            borderRadius: isSelf
              ? "14px 14px 4px 14px"
              : "14px 14px 14px 4px",
            color: isError
              ? "var(--red)"
              : isSelf
              ? "#fff"
              : "var(--text)",
          }}
        >
          <MarkdownContent
            content={msg.content}
            isSelf={isSelf}
            isError={isError}
            isAgent={isAgent}
            agentConfig={agentConfig}
          />
        </div>

        {/* Timestamp */}
        <span
          className="text-[0.67rem]"
          style={{
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