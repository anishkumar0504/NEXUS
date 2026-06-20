import { useState, useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { useSearch } from "./hooks/useSearch";
// Import BOTH hooks
import { 
  useGroupChats } from "./hooks/useGroupChats"; // For the list
import { ChatPage } from "./components/chat/ChatPage"; 
import { Auth } from "./components/Auth";
import { Sidebar } from "./components/Sidebar";
import { HomePage } from "./components/HomePage";
import { ResultView } from "./components/ResultView";

export default function App() {
  const { user, token, loading: authLoading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Search State
  const {
    state,
    conversations,
    loadingConversations,
    search,
    followUp,
    loadConversation,
    removeConversation,
    newSearch,
  } = useSearch(token);

  // Group Chat List State & Hook
  const {
    groupChats,
    loadingGroupChats,
    createGroupChat,
    deleteGroupChat,
    joinGroupChat,
  } = useGroupChats(token); // Use the plural hook here

  const [activeGroupChatId, setActiveGroupChatId] = useState<string | null>(null);

  // On mount, check if URL has a conversation ID or Group Chat ID
  useEffect(() => {
    if (!token) return;
    
    // Check for standard conversation
    const convMatch = window.location.pathname.match(/^\/c\/(.+)$/);
    if (convMatch) {
      loadConversation(convMatch[1]);
      setActiveGroupChatId(null);
      return;
    }

    // Check for group chat (assuming route /g/:id)
    const groupMatch = window.location.pathname.match(/^\/g\/(.+)$/);
    if (groupMatch) {
      setActiveGroupChatId(groupMatch[1]);
    }
  }, [token]);

  // When conversation changes, update the URL
  useEffect(() => {
    if (state.conversationId) {
      window.history.pushState({}, "", `/c/${state.conversationId}`);
    }
  }, [state.conversationId]);

  // When group chat changes, update the URL
  useEffect(() => {
    if (activeGroupChatId) {
      window.history.pushState({}, "", `/g/${activeGroupChatId}`);
    } else if (!state.conversationId) {
       window.history.pushState({}, "", "/");
    }
  }, [activeGroupChatId, state.conversationId]);

  const handleNewSearch = () => {
    setSidebarOpen(false);
    setActiveGroupChatId(null);
    window.history.pushState({}, "", "/");
    newSearch();
  };

  const handleSelectConversation = (id: string) => {
    setSidebarOpen(false);
    setActiveGroupChatId(null);
    window.history.pushState({}, "", `/c/${id}`);
    loadConversation(id);
  };

  // Handlers for Group Chats
  const handleSelectGroupChat = (id: string) => {
    setSidebarOpen(false);
    setActiveGroupChatId(id);
    window.history.pushState({}, "", `/g/${id}`);
  };

  const handleCreateGroupChat = async (name: string) => {
    try {
      const newChat = await createGroupChat(name);
      setActiveGroupChatId(newChat.id);
      window.history.pushState({}, "", `/g/${newChat.id}`);
    } catch (error) {
      console.error("Failed to create group chat", error);
    }
  };

  const handleJoinGroupChat = async (groupId: string) => {
    try {
      // joinGroupChat now returns void and handles refreshing the list internally
      await joinGroupChat(groupId);
      
      // Use the groupId we already have instead of joinedChat.id
      setActiveGroupChatId(groupId);
      window.history.pushState({}, "", `/g/${groupId}`);
    } catch (error) {
      console.error("Failed to join group chat", error);
      throw error;
    }
  };

  const handleDeleteGroupChat = async (id: string) => {
    try {
      await deleteGroupChat(id);
      if (activeGroupChatId === id) {
        setActiveGroupChatId(null);
        window.history.pushState({}, "", "/");
      }
    } catch (error) {
      console.error("Failed to delete group chat", error);
    }
  };

  if (authLoading) {
    return (
      <div className="app-loading">
        <span className="app-loading-icon">⬡</span>
      </div>
    );
  }

  if (!user) return <Auth />;

  const name =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "there";

  const hasResult = !!(
    state.query && (
      state.answer ||
      state.loading ||
      state.error ||
      state.allMessages.length > 0
    )
  );

  const showGroupChat = !!activeGroupChatId;

  return (
    <div className="app">
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(prev => !prev)}
        aria-label="Toggle menu"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <Sidebar
        // Existing Props
        conversations={conversations}
        loadingConversations={loadingConversations}
        activeConversationId={state.conversationId}
        user={user}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={removeConversation}
        onNewSearch={handleNewSearch}
        onSignOut={signOut}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        
        // New Group Chat Props
        groupChats={groupChats}
        loadingGroupChats={loadingGroupChats}
        activeGroupChatId={activeGroupChatId}
        onSelectGroupChat={handleSelectGroupChat}
        onDeleteGroupChat={handleDeleteGroupChat}
        onCreateGroupChat={handleCreateGroupChat}
        onJoinGroupChat={handleJoinGroupChat}
      />

      <main className="main-content">
        {showGroupChat ? (
          <ChatPage 
            groupChatId={activeGroupChatId} 
            token={token} 
            currentUserId={user.id} 
            onBack={() => {
              setActiveGroupChatId(null);
              window.history.pushState({}, "", "/");
            }}
          />
        ) : hasResult ? (
          <ResultView
            query={state.query}
            answer={state.answer}
            sources={state.sources}
            followUps={state.followUps}
            loading={state.loading}
            error={state.error}
            allMessages={state.allMessages}
            onFollowUp={followUp}
          />
        ) : (
          <HomePage
            onSearch={search}
            loading={state.loading}
            userName={name}
          />
        )}
      </main>
    </div>
  );
}