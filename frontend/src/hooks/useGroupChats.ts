import { useState, useEffect, useCallback } from "react";
import {
  getGroupChats,
  createGroupChat,
  deleteGroupChat,
  joinGroupChat,
  type GroupChat,
} from "../lib/groupchat";

export interface UseGroupChatsReturn {
  groupChats: GroupChat[];
  loadingGroupChats: boolean;
  error: string | null;
  createGroupChat: (name: string) => Promise<GroupChat>;
  deleteGroupChat: (id: string) => Promise<void>;
  joinGroupChat: (inviteCode: string) => Promise<GroupChat>;
  refresh: () => void;
}

export function useGroupChats(token: string | null): UseGroupChatsReturn {
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [loadingGroupChats, setLoadingGroupChats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    if (!token) return;
    setLoadingGroupChats(true);
    setError(null);
    try {
      const chats = await getGroupChats(token);
      setGroupChats(chats);
    } catch (err: any) {
      setError(err.message || "Failed to fetch group chats");
    } finally {
      setLoadingGroupChats(false);
    }
  }, [token]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const handleCreate = async (name: string) => {
    if (!token) throw new Error("Not authenticated");
    const newChat = await createGroupChat(token, name);
    setGroupChats((prev) => [...prev, newChat]);
    return newChat;
  };

  const handleDelete = async (id: string) => {
    if (!token) throw new Error("Not authenticated");
    await deleteGroupChat(token, id);
    setGroupChats((prev) => prev.filter((c) => c.id !== id));
  };

  const handleJoin = async (inviteCode: string) => {
    if (!token) throw new Error("Not authenticated");
    const joinedChat = await joinGroupChat(token, inviteCode);
    // Avoid duplicates if already in list
    setGroupChats((prev) => {
      if (prev.some((c) => c.id === joinedChat.id)) return prev;
      return [...prev, joinedChat];
    });
    return joinedChat;
  };

  return {
    groupChats,
    loadingGroupChats,
    error,
    createGroupChat: handleCreate,
    deleteGroupChat: handleDelete,
    joinGroupChat: handleJoin,
    refresh: fetchChats,
  };
}