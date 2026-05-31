// App.tsx — replace the whole file

import { useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { useSearch } from "./hooks/useSearch";
import { Auth } from "./components/Auth";
import { Sidebar } from "./components/Sidebar";
import { HomePage } from "./components/HomePage";
import { ResultView } from "./components/ResultView";

export default function App() {
  const { user, token, loading: authLoading, signOut } = useAuth();

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

  // On mount, check if URL has a conversation ID and load it
  useEffect(() => {
    if (!token) return;
    const match = window.location.pathname.match(/^\/c\/(.+)$/);
    if (match) {
      loadConversation(match[1]);
    }
  }, [token]);

  // When conversation changes, update the URL
  useEffect(() => {
    if (state.conversationId) {
      window.history.pushState({}, "", `/c/${state.conversationId}`);
    }
  }, [state.conversationId]);

  const handleNewSearch = () => {
    window.history.pushState({}, "", "/");
    newSearch();
  };

  const handleSelectConversation = (id: string) => {
    window.history.pushState({}, "", `/c/${id}`);
    loadConversation(id);
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

  const hasResult = !!(state.query && (state.answer || state.loading || state.error));

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        loading={loadingConversations}
        activeConversationId={state.conversationId}
        user={user}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={removeConversation}
        onNewSearch={handleNewSearch}
        onSignOut={signOut}
      />

      <main className="main-content">
        {hasResult ? (
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