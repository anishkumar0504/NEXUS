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
  joinGroupChat: (groupId: string) => Promise<void>; // Changed to void as we refresh list
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

  const handleJoin = async (groupId: string) => {
    if (!token) throw new Error("Not authenticated");
    
    // joinGroupChat now returns { message, groupId }, not the full chat object
    await joinGroupChat(token, groupId);
    
    // Refresh the entire list to get the newly joined group with full details (members, etc.)
    await fetchChats();
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