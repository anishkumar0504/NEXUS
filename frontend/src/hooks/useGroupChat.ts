import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  buildInviteLink,
  getGroupChat,
  getGroupMessages,
  postGroupMessage, // ← ADDED
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

    Promise.all([
      getGroupChat(token, groupChatId),
      getGroupMessages(token, groupChatId),
    ])
      .then(([groupData, messagesData]) => {
        if (cancelled) return;
        setChat(groupData);

        // Merge: DB data is source of truth. Socket messages that arrived
        // while loading are merged in, but pending optimistics (tempId as id)
        // are replaced by their confirmed DB counterparts.
        setMessages((prev) => {
          if (prev.length === 0) return messagesData;

          const byId = new Map<string, GroupMessage>();

          // DB messages first (source of truth, have user/agent)
          for (const m of messagesData) byId.set(m.id, m);

          // Merge socket messages: skip if already in DB by real id,
          // but also check if any pending message's tempId matches a DB message
          for (const m of prev) {
            const mTempId = (m as any).tempId;
            // If this pending message's tempId matches a DB message's tempId,
            // the DB version already replaced it — skip
            const alreadyConfirmed = Array.from(byId.values()).some(
              (dbm) => (dbm as any).tempId === mTempId
            );
            if (alreadyConfirmed) continue;

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
  useEffect(() => {
    if (!groupChatId || !token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-group", groupChatId); // ← FIXED: kebab-case, string
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    const handleMessage = (msg: GroupMessage & { tempId?: string }) => {
      setMessages((prev) => {
        // 1. Reconcile: if this confirmed message matches a pending optimistic
        //    by tempId, replace the pending one (don't append).
        const pendingIdx = prev.findIndex(
          (m) => (m as any).tempId && (m as any).tempId === msg.tempId
        );
        if (pendingIdx !== -1) {
          const next = [...prev];
          next[pendingIdx] = msg;
          return next;
        }

        // 2. Deduplicate by real id
        if (prev.some((m) => m.id === msg.id)) return prev;

        // 3. New message — append and sort
        return [...prev, msg].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      if (msg.senderType === "AGENT") {
        setAgentThinking(false);
      } else if (
        msg.senderType === "USER" &&
        msg.userId === currentUserIdRef.current
      ) {
        setSending(false);
      }
    };

socket.on("new-message", (rawMsg: any) => {
  console.log("[SOCKET] new-message received:", {
    id: rawMsg.id,
    tempId: rawMsg.tempId,
    content: rawMsg.content?.slice(0, 30),
    senderType: rawMsg.senderType,
    hasUser: !!rawMsg.user,
    userName: rawMsg.user?.name,
  });
  handleMessage(rawMsg);
});    socket.on("group_message", handleMessage); // ← backwards compat for joinGroup

    socket.on("member_joined", ({ member }: { member: GroupMember }) => {
      setChat((prev) => {
        if (!prev) return prev;
        if (prev.members.some((m) => m.id === member.id)) return prev;
        return { ...prev, members: [...prev.members, member] };
      });
    });

    socket.on("agent_thinking", () => {
      setAgentThinking(true);
    });

    socket.on("connect_error", (err) => {
      setError(`Socket error: ${err.message}`);
      setConnected(false);
    });

    return () => {
      socket.emit("leave-group", groupChatId); // ← FIXED: kebab-case, string
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [groupChatId, token]);

  // ── Send message ─────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string) => {
      if (!groupChatId || !token || !content.trim()) return;

      const tempId = crypto.randomUUID();

      // Build optimistic message with tempId stored for reconciliation
      const optimisticMsg: GroupMessage & { tempId: string } = {
        id: tempId, // use tempId as id initially so React key is stable
        tempId,
        content: content.trim(),
        sources: null,
        groupChatId,
        senderType: "USER",
        userId: currentUserIdRef.current,
        agentId: null,
        createdAt: new Date().toISOString(),
        user: {
          id: currentUserIdRef.current!,
          name: "You",
          email: "",
          provider: "",
        },
        agent: null,
      };
// Inside sendMessage, right after creating optimisticMsg:
console.log("[OPTIMISTIC] created:", { id: optimisticMsg.id, tempId: optimisticMsg.tempId });
      setMessages((prev) => [...prev, optimisticMsg]);
      setSending(true);

      try {
        await postGroupMessage(token, groupChatId, content.trim());
        // Fallback: if socket event is delayed/missed, clear sending after 3s
        setTimeout(() => setSending(false), 3000);
      } catch (err: any) {
        setError(err.message || "Failed to send message");
        // Remove optimistic message on failure
        setMessages((prev) =>
          prev.filter((m) => (m as any).tempId !== tempId)
        );
        setSending(false);
      }
    },
    [groupChatId, token]
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