const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface Source {
  url: string;
  title?: string;
}

export interface Message {
  id: string;
  content: string;
  role: "USER" | "ASSISTANT";
  sources?: Source[] | null;
  createdAt: string;
  conversationId: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  userId: string;
  messages: Message[];
}

function getHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ── Conversations ──────────────────────────────────────────────
export async function getConversations(token: string): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE}/conversations`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch conversations");
  const data = await res.json();
  return data.conversations;
}

export async function getConversation(
  token: string,
  conversationId: string
): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/conversation/${conversationId}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch conversation");
  const data = await res.json();
  return data.conversation;
}

export async function deleteConversation(
  token: string,
  conversationId: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/conversation/${conversationId}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to delete conversation");
}

// ── Streaming search ───────────────────────────────────────────
// Parses the streamed response into answer chunks + final sources
// The backend sends: <answer text>\n<SOURCES>\n[...json]\n</SOURCES>\n

export interface StreamResult {
  answer: string;
  sources: Source[];
  followUps: string[];
}

// Parses <ANSWER>...</ANSWER> and <FOLLOW_UPS><question>...</question></FOLLOW_UPS>
function parseStructuredAnswer(raw: string): {
  answer: string;
  followUps: string[];
} {
  const answerMatch = raw.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
  const answer = answerMatch ? answerMatch[1].trim() : raw.trim();

  const followUps: string[] = [];
  const followUpRegex = /<question>([\s\S]*?)<\/question>/g;
  let match;
  while ((match = followUpRegex.exec(raw)) !== null) {
    followUps.push(match[1].trim());
  }

  return { answer, followUps };
}

export async function streamAsk(
  token: string,
  query: string,
  onChunk: (chunk: string) => void,
  onSources: (sources: Source[]) => void,
  onFollowUps: (followUps: string[]) => void,
  onConversationId: (id: string) => void
): Promise<void> {
  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Search failed");
  }

  await readStream(res, onChunk, onSources, onFollowUps, onConversationId);
}

export async function streamFollowup(
  token: string,
  conversationId: string,
  query: string,
  onChunk: (chunk: string) => void,
  onSources: (sources: Source[]) => void,
  onFollowUps: (followUps: string[]) => void
): Promise<void> {
  const res = await fetch(`${API_BASE}/ask/followup`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ conversationId, query }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Follow-up failed");
  }

  await readStream(res, onChunk, onSources, onFollowUps, () => {});
}

// Shared stream reader — handles chunked response + source extraction
async function readStream(
  res: Response,
  onChunk: (chunk: string) => void,
  onSources: (sources: Source[]) => void,
  onFollowUps: (followUps: string[]) => void,
  onConversationId: (id: string) => void
) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sourcesReceived = false;
  let answerDone = false;
  let convIdSent = false; // ← ADD THIS

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    if (!sourcesReceived && !answerDone) {
      if (buffer.includes("\n<SOURCES>\n")) {
        const [answerPart, rest] = buffer.split("\n<SOURCES>\n");
        const { answer, followUps } = parseStructuredAnswer(answerPart);
        onChunk(answer);
        onFollowUps(followUps);
        answerDone = true;

        if (rest && rest.includes("\n</SOURCES>\n")) {
          const [sourcesJson, after] = rest.split("\n</SOURCES>\n");
          try { onSources(JSON.parse(sourcesJson.trim())); }
          catch { onSources([]); }
          sourcesReceived = true;

          const convMatch = (after || "").match(/<CONV_ID>(.+?)<\/CONV_ID>/);
          if (convMatch && !convIdSent) { // ← ADD !convIdSent
            convIdSent = true;
            onConversationId(convMatch[1]);
          }
        }
      } else {
        const { answer } = parseStructuredAnswer(buffer);
        onChunk(answer);
      }
    }

    // ← ADD !convIdSent here too
    if (sourcesReceived && !convIdSent && buffer.includes("<CONV_ID>")) {
      const convMatch = buffer.match(/<CONV_ID>(.+?)<\/CONV_ID>/);
      if (convMatch) {
        convIdSent = true;
        onConversationId(convMatch[1]);
      }
    }
  }

  if (!sourcesReceived && buffer) {
    const { answer, followUps } = parseStructuredAnswer(buffer);
    onChunk(answer);
    onFollowUps(followUps);
    onSources([]);
  }
}