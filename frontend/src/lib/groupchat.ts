const API_BASE = "http://localhost:3000/groups";

export interface GroupMember {
  id: string;
  userId: string;
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
  createdAt: string;
  members: GroupMember[];
  // Note: The getGroup route doesn't explicitly include messages in the Prisma query,
  // so we might need to fetch them separately via getMessages
}

function getHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ── Group Management ────────────────────────────────────────────────

/**
 * Fetches all groups the user is a member of.
 * Note: Your backend routes don't show a "list all groups" endpoint.
 * If you have one, update the URL below. Otherwise, this might need to be removed 
 * or implemented on the backend.
 */
export async function getGroupChats(token: string): Promise<GroupChat[]> {
  // Assuming there is a GET /groups endpoint that lists user's groups. 
  // If not, you might need to add it to your backend.
  // For now, pointing to root which usually implies list in REST, 
  // but your router only has POST / (create). 
  // You might need to add: groupRouter.get("/", getUserGroups);
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

/**
 * Joins a group using its ID.
 * Note: Your backend route is POST /:groupId/join
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
    throw new Error(error.error || "Failed to join group");
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

/**
 * Posts a message to a group.
 * Returns a tempId for optimistic UI updates.
 */
export async function postGroupMessage(
  token: string,
  groupId: string,
  content: string
): Promise<{ status: string; tempId: string }> {
  const res = await fetch(`${API_BASE}/${groupId}/message`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to send message");
  }
  const data = await res.json();
  return data;
}