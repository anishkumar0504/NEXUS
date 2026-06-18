import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  buildInviteLink,
  getGroupChat,
  getGroupMessages,
  type GroupChat,
  type GroupMessage,
} from "../lib/groupchat";

const SOCKET_URL = "http://localhost:3000";

export interface UseGroupChatReturn {
  chat: GroupChat | null;
  messages: GroupMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  connected: boolean;
  sendMessage: (content: string) => void;
  copyInviteLink: () => Promise<void>;
  inviteCopied: boolean;
}

export function useGroupChat(
  groupChatId: string | null,
  token: string | null
): UseGroupChatReturn {
  const [chat, setChat] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const socketRef = useRef<Socket | null>(null);

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
      getGroupMessages(token, groupChatId)
    ])
      .then(([groupData, messagesData]) => {
        if (cancelled) return;
        setChat(groupData);
        setMessages(messagesData);
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
  useEffect(() => {
    if (!groupChatId || !token) return;

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

    // New message from any user or agent
    socket.on("group_message", (msg: GroupMessage) => {
      setMessages((prev) => {
        // Deduplicate by id
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // If an agent is typing indicator was shown, clear it
      if (msg.senderType === "AGENT") {
        setSending(false);
      }
    });

    // Agent is working (typing indicator)
    socket.on("agent_thinking", () => {
      setSending(true);
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
  }, [groupChatId, token]);

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
    
    // Use chat.id instead of inviteCode
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
    error,
    connected,
    sendMessage,
    copyInviteLink,
    inviteCopied,
  };
}