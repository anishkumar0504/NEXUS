// const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

const API_BASE =  "http://localhost:3000";



export interface GroupMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export interface Agent {
  id: string;
  name: string;
  type: "SUMMARIZER" | "IMAGE_GEN" | string;
}

export interface GroupMessage {
  id: string;
  content: string;
  sources: null | unknown[];
  groupChatId: string;
  senderType: "USER" | "AGENT";
  userId: string | null;
  agentId: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    provider: string;
  } | null;
  agent: Agent | null;
}

export interface GroupChat {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  members: GroupMember[];
  messages: GroupMessage[];
}

function getHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ── Group Chats ────────────────────────────────────────────────

export async function getGroupChats(token: string): Promise<GroupChat[]> {
  const res = await fetch(`${API_BASE}/group-chat`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch group chats");
  const data = await res.json();
  return data.groupChats;
}

export async function getGroupChat(
  token: string,
  groupChatId: string
): Promise<GroupChat> {
  const res = await fetch(`${API_BASE}/group-chat/${groupChatId}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch group chat");
  const data = await res.json();
  return data.groupChat;
}

export async function createGroupChat(
  token: string,
  name: string
): Promise<GroupChat> {
  const res = await fetch(`${API_BASE}/group-chat`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create group chat");
  const data = await res.json();
  return data.groupChat;
}

export async function deleteGroupChat(
  token: string,
  groupChatId: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/group-chat/${groupChatId}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to delete group chat");
}

export async function joinGroupChat(
  token: string,
  inviteCode: string
): Promise<GroupChat> {
  const res = await fetch(`${API_BASE}/group-chat/join`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ inviteCode }),
  });
  if (!res.ok) throw new Error("Invalid invite code");
  const data = await res.json();
  return data.groupChat;
}

/** Returns a shareable URL with the invite code embedded */
export function buildInviteLink(inviteCode: string): string {
  const base = window.location.origin;
  return `${base}/join/${inviteCode}`;
}