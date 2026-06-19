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
  joinGroupChat: (groupId: string) => Promise<void>;
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

  // ✅ Optimistic Create
  const handleCreate = async (name: string) => {
    if (!token) throw new Error("Not authenticated");

    // 1. Generate temp ID & add immediately
    const tempId = crypto.randomUUID();
    const optimisticChat: GroupChat = {
      id: tempId,
      name,
      members: [], // Placeholder
      _count: { messages: 0 },
      createdAt: new Date().toISOString(),
    } as unknown as GroupChat;

    setGroupChats((prev) => [optimisticChat, ...prev]);

    try {
      const realChat = await createGroupChat(token, name);
      // 2. Replace optimistic with real data from server
      setGroupChats((prev) =>
        prev.map((c) => (c.id === tempId ? realChat : c))
      );
      return realChat;
    } catch (err) {
      // 3. Rollback on failure
      setGroupChats((prev) => prev.filter((c) => c.id !== tempId));
      throw err;
    }
  };

  // ✅ Optimistic Join
  const handleJoin = async (groupId: string) => {
    if (!token) throw new Error("Not authenticated");

    // 1. Check if already in list to avoid duplicates
    const alreadyJoined = groupChats.some((c) => c.id === groupId);
    if (alreadyJoined) return;

    // 2. Add placeholder immediately
    const optimisticChat: GroupChat = {
      id: groupId,
      name: "Loading...",
      members: [],
      _count: { messages: 0 },
      createdAt: new Date().toISOString(),
    } as unknown as GroupChat;

    setGroupChats((prev) => [...prev, optimisticChat]);

    try {
      await joinGroupChat(token, groupId);
      // 3. Refresh to get full group details (members, name, etc.)
      await fetchChats();
    } catch (err) {
      // 4. Rollback on failure
      setGroupChats((prev) => prev.filter((c) => c.id !== groupId));
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) throw new Error("Not authenticated");
    
    // Optional: Optimistic delete too
    setGroupChats((prev) => prev.filter((c) => c.id !== id));
    
    try {
      await deleteGroupChat(token, id);
    } catch (err) {
      // Rollback if delete fails
      fetchChats();
      throw err;
    }
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