// src/lib/groupchat.ts

const API_BASE = "http://localhost:3000/groups";

export interface GroupMember {
  id: string;
  userId: string;
  groupChatId: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
}

export interface Agent {
  id: string;
  name: string;
  type: "SUMMARIZER" | "IMAGE_GEN" | string;
}

export interface GroupMessage {
  id: string;
  content: string;
  sources: null | {
    image?: string;
  };
  groupChatId: string;
  senderType: "USER" | "AGENT" | "SYSTEM";
  userId: string | null;
  agentId: string | null;
  triggeringUserId?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    provider: string;
  } | null;
  agent: {
    id: string;
    name: string;
    type: string;
  } | null;
}

export interface GroupChat {
  id: string;
  name: string;
  createdAt: string;
  members: GroupMember[];
}

function getHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ── Group Chats ────────────────────────────────────────────────

export async function getGroupChats(token: string): Promise<GroupChat[]> {
  // NOTE: Ensure you have a GET /groups route on your backend that returns { groups: [] }
  const res = await fetch(`${API_BASE}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch group chats");
  const data = await res.json();
  return data.groups || [];
}

export async function getGroupChat(
  token: string,
  groupId: string
): Promise<GroupChat> {
  const res = await fetch(`${API_BASE}/${groupId}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch group chat");
  const data = await res.json();
  return data.group;
}

export async function createGroupChat(
  token: string,
  name: string
): Promise<GroupChat> {
  const res = await fetch(`${API_BASE}`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create group chat");
  const data = await res.json();
  return data.group;
}

// If you don't have a delete route yet, you can comment this out or implement it later
export async function deleteGroupChat(
  token: string,
  groupId: string
): Promise<void> {
  // Assuming a DELETE /groups/:groupId route exists
  const res = await fetch(`${API_BASE}/${groupId}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to delete group chat");
}

/**
 * Joins a group using its ID.
 * Returns the response from the backend which includes groupId.
 */
export async function joinGroupChat(
  token: string,
  groupId: string
): Promise<{ message: string; groupId: string }> {
  const res = await fetch(`${API_BASE}/${groupId}/join`, {
    method: "POST",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Invalid invite code or group ID");
  }
  const data = await res.json();
  return data;
}

// ── Messages ────────────────────────────────────────────────

export async function getGroupMessages(
  token: string,
  groupId: string
): Promise<GroupMessage[]> {
  const res = await fetch(`${API_BASE}/${groupId}/messages`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  const data = await res.json();
  return data.messages;
}

export async function postGroupMessage(
  token: string,
  groupId: string,
  content: string,
  tempId : string,
): Promise<{ status: string; tempId: string }> {
  const res = await fetch(`${API_BASE}/${groupId}/message`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ content,tempId }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to send message");
  }
  const data = await res.json();
  return data;
}

// Helper for invite links if you still want to support them via URL params
export function buildInviteLink(groupId: string): string {
  const base = window.location.origin;
  return `${base}/join/${groupId}`;
}