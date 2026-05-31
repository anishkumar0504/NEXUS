import { useState, useCallback, useEffect } from "react";
import {
  streamAsk,
  streamFollowup,
  getConversations,
  getConversation,
  deleteConversation,
} from "../lib/api";
import type { Conversation, Source, Message } from "../lib/api";

export interface ChatMessage {
  role: "USER" | "ASSISTANT";
  content: string;
  sources?: Source[];
  followUps?: string[];
}

export interface SearchState {
  query: string;          // current/latest query shown in header
  answer: string;         // current streaming answer
  sources: Source[];
  followUps: string[];
  loading: boolean;
  error: string | null;
  conversationId: string | null;
  allMessages: ChatMessage[];  // full thread
}

const EMPTY_STATE: SearchState = {
  query: "",
  answer: "",
  sources: [],
  followUps: [],
  loading: false,
  error: null,
  conversationId: null,
  allMessages: [],
};

const CACHE_KEY = "nexus_conversations";

function readCache(): Conversation[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeCache(conversations: Conversation[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(conversations));
  } catch {}
}

function stripTags(raw: string): string {
  const answerMatch = raw.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
  return answerMatch ? answerMatch[1].trim() : raw.trim();
}

function extractFollowUps(raw: string): string[] {
  const result: string[] = [];
  const re = /<question>([\s\S]*?)<\/question>/g;
  let m;
  while ((m = re.exec(raw)) !== null) result.push(m[1].trim());
  return result;
}

// Converts DB messages array into ChatMessage pairs
function buildAllMessages(messages: Message[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const msg of messages) {
    if (msg.role === "USER") {
      result.push({ role: "USER", content: msg.content });
    } else {
      result.push({
        role: "ASSISTANT",
        content: stripTags(msg.content),
        sources: (msg.sources as Source[]) || [],
        followUps: extractFollowUps(msg.content),
      });
    }
  }
  return result;
}

export function useSearch(token: string | null) {
  const [state, setState] = useState<SearchState>(EMPTY_STATE);
  const [conversations, setConversations] = useState<Conversation[]>(readCache);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    setLoadingConversations(true);
    try {
      const data = await getConversations(token);
      setConversations(data);
      writeCache(data);
    } catch {}
    finally { setLoadingConversations(false); }
  }, [token]);

  useEffect(() => {
    if (token) fetchConversations();
    else {
      setConversations([]);
      localStorage.removeItem(CACHE_KEY);
      setState(EMPTY_STATE);
    }
  }, [token]);

  const search = useCallback(async (query: string) => {
    if (!token || !query.trim()) return;

    // Add user message immediately to allMessages
    setState((s) => ({
      ...s,
      query,
      answer: "",
      sources: [],
      followUps: [],
      loading: true,
      error: null,
      conversationId: null,
      allMessages: [...s.allMessages, { role: "USER", content: query }],
    }));

    try {
      await streamAsk(
        token,
        query,
        (chunk) => setState((s) => ({ ...s, answer: chunk })),
        (sources) => setState((s) => ({ ...s, sources, loading: false })),
        (followUps) => setState((s) => ({ ...s, followUps })),
        (id) => {
          // Once streaming done, move answer into allMessages
          setState((s) => ({
            ...s,
            answer: "",
                loading: false,  
            conversationId: id,
            allMessages: [
              ...s.allMessages,
              {
                role: "ASSISTANT",
                content: s.answer,
                sources: s.sources,
                followUps: s.followUps,
              },
            ],
          }));
          setTimeout(fetchConversations, 600);
        }
      );
    } catch (err: any) {
      setState((s) => ({
        ...s,
        answer: "",
        loading: false,
        error: err.message || "Something went wrong",
      }));
    }
  }, [token, fetchConversations]);

  const followUp = useCallback(async (query: string) => {
    if (!token || !state.conversationId || !query.trim()) return;

    // Append user follow-up message immediately
    setState((s) => ({
      ...s,
      query,
      answer: "",
      sources: [],
      followUps: [],
      loading: true,
      error: null,
      allMessages: [...s.allMessages, { role: "USER", content: query }],
    }));

    try {
      await streamFollowup(
        token,
        state.conversationId,
        query,
        (chunk) => setState((s) => ({ ...s, answer: chunk })),
        (sources) => setState((s) => ({ ...s, sources, loading: false })),
        (followUps) => setState((s) => ({ ...s, followUps }))
      );

      // Append assistant answer into allMessages once done
      setState((s) => ({
        ...s,
        allMessages: [
          ...s.allMessages,
          {
            role: "ASSISTANT",
            content: s.answer,
            sources: s.sources,
            followUps: s.followUps,
          },
        ],
      }));

      setTimeout(fetchConversations, 600);
    } catch (err: any) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err.message || "Something went wrong",
      }));
    }
  }, [token, state.conversationId, fetchConversations]);

  const loadConversation = useCallback(async (conversationId: string) => {
    if (!token) return;
    try {
      const conv = await getConversation(token, conversationId);

      // Update cache with full messages
      const cached = readCache();
      const updated = cached.map((c) => c.id === conversationId ? conv : c);
      writeCache(updated);
      setConversations(updated);

      const messages = conv.messages;
      const lastUser = [...messages].reverse().find((m) => m.role === "USER");
      const lastAssistant = [...messages].reverse().find((m) => m.role === "ASSISTANT");

      if (lastUser && lastAssistant) {
        setState({
          query: lastUser.content,
          answer: stripTags(lastAssistant.content),
          sources: (lastAssistant.sources as Source[]) || [],
          followUps: extractFollowUps(lastAssistant.content),
          loading: false,
          error: null,
          conversationId,
          allMessages: buildAllMessages(messages),  // full history
        });
      }
    } catch {}
  }, [token]);

  const removeConversation = useCallback(async (conversationId: string) => {
    if (!token) return;
    try {
      await deleteConversation(token, conversationId);
      const updated = conversations.filter((c) => c.id !== conversationId);
      setConversations(updated);
      writeCache(updated);
      if (state.conversationId === conversationId) {
        window.history.pushState({}, "", "/");
        newSearch();
      }
    } catch {}
  }, [token, conversations, state.conversationId]);

  const newSearch = useCallback(() => {
    setState(EMPTY_STATE);
  }, []);

  return {
    state,
    conversations,
    loadingConversations,
    search,
    followUp,
    fetchConversations,
    loadConversation,
    removeConversation,
    newSearch,
  };
}