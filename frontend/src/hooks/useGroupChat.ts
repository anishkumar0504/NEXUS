//useGroupChat
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  buildInviteLink,
  getGroupChat,
  getGroupMessages,
  type GroupChat,
  type GroupMember,
  type GroupMessage,
} from "../lib/groupchat";

const SOCKET_URL = "http://localhost:3000";

export interface UseGroupChatReturn {
  chat: GroupChat | null;
  messages: GroupMessage[];
  loading: boolean;
  sending: boolean;
  agentThinking: boolean;
  error: string | null;
  connected: boolean;
  sendMessage: (content: string) => void;
  copyInviteLink: () => Promise<void>;
  inviteCopied: boolean;
}

export function useGroupChat(
  groupChatId: string | null,
  token: string | null,
  currentUserId: string | null
): UseGroupChatReturn {
  const [chat, setChat] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [agentThinking, setAgentThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  // mirrors currentUserId so the socket handler (set up once per groupChatId/token)
  // always sees the latest value without needing to be in its effect deps
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;

  // ── Fetch initial chat data ──────────────────────────────────
  useEffect(() => {
    if (!groupChatId || !token) {
      setChat(null);
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Fetch both group details and messages in parallel
    Promise.all([
      getGroupChat(token, groupChatId),
      getGroupMessages(token, groupChatId),
    ])
      .then(([groupData, messagesData]) => {
        if (cancelled) return;
        setChat(groupData);
        // Merge, don't overwrite — the socket connects in a separate effect and
        // may have already delivered messages (e.g. a join system message,
        // or a teammate's message) before this REST call resolves. A plain
        // overwrite here would silently drop those.
        setMessages((prev) => {
          if (prev.length === 0) return messagesData;
          const byId = new Map(messagesData.map((m) => [m.id, m]));
          for (const m of prev) {
            if (!byId.has(m.id)) byId.set(m.id, m);
          }
          return Array.from(byId.values()).sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [groupChatId, token]);

  // ── Socket.IO connection ─────────────────────────────────────
  // Waits for `loading` to clear so join_group fires after initial history
  // is in state — avoids the race where a live event arrives before the
  // REST snapshot does (the merge above is a second line of defense).
  useEffect(() => {
    if (!groupChatId || !token || loading) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join_group", { groupChatId });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    // New message from any user, agent, or system event (e.g. "joined the group")
    socket.on("group_message", (msg: GroupMessage) => {
      setMessages((prev) => {
        // Deduplicate by id
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      if (msg.senderType === "AGENT") {
        setAgentThinking(false);
      } else if (
        msg.senderType === "USER" &&
        msg.userId === currentUserIdRef.current
      ) {
        // our own message round-tripped back — stop the "sending" state
        setSending(false);
      }
    });

    // A new member joined — live-patch the member list / avatar stack.
    // The "X joined the group" line in the timeline arrives separately
    // via the group_message (SYSTEM) event above.
    socket.on("member_joined", ({ member }: { member: GroupMember }) => {
      setChat((prev) => {
        if (!prev) return prev;
        if (prev.members.some((m) => m.id === member.id)) return prev;
        return { ...prev, members: [...prev.members, member] };
      });
    });

    // Agent is working (typing indicator) — independent of our own send state
    socket.on("agent_thinking", () => {
      setAgentThinking(true);
    });

    socket.on("connect_error", (err) => {
      setError(`Socket error: ${err.message}`);
      setConnected(false);
    });

    return () => {
      socket.emit("leave_group", { groupChatId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [groupChatId, token, loading]);

  // ── Send message ─────────────────────────────────────────────
  const sendMessage = useCallback(
    (content: string) => {
      const socket = socketRef.current;
      if (!socket || !groupChatId || !content.trim()) return;

      setSending(true);
      socket.emit("send_message", { groupChatId, content: content.trim() });
    },
    [groupChatId]
  );

  // ── Copy invite link ─────────────────────────────────────────
  const copyInviteLink = useCallback(async () => {
    if (!chat?.id) return;

    const link = buildInviteLink(chat.id);

    try {
      await navigator.clipboard.writeText(link);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      // Fallback for older browsers / non-HTTPS
      const ta = document.createElement("textarea");
      ta.value = link;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    }
  }, [chat]);

  return {
    chat,
    messages,
    loading,
    sending,
    agentThinking,
    error,
    connected,
    sendMessage,
    copyInviteLink,
    inviteCopied,
  };
}