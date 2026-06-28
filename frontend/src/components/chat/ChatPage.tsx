// src/components/chat/ChatPage.tsx
import { useGroupChat } from "../../hooks/useGroupChat";
import { ResearchAgentPanel } from "../ResearchAgentPanel";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { useMemo } from "react";

interface ChatPageProps {
  groupChatId: string | null;
  token: string | null;
  currentUserId: string | null;
  onBack?: () => void;
}

export function ChatPage({ groupChatId, token, currentUserId, onBack }: ChatPageProps) {
  const {
    chat,
    messages,
    loading,
    sending,
    agentThinking,
    error,
    connected,
    sendMessage,
    copyInviteLink,
    inviteCopied,
    socket,
  } = useGroupChat(groupChatId, token, currentUserId);

  // Find active research job from messages
  const activeResearchJobId = useMemo(() => {
    const last = [...messages]
      .reverse()
      .find((m) => 
        m.senderType === "AGENT" && 
        m.agent?.name === "research" &&
        !(m as any).isComplete &&
        !!(m as any).jobId
      );
    return (last as any)?.jobId || null;
  }, [messages]);

  const activeAgentName = messages
    .filter((m) => m.senderType === "AGENT")
    .slice(-1)[0]?.agent?.name;

  function handleSelectPlanOption(option: string) {
    if (option === "__skip__") {
      sendMessage("Proceed with your plan.");
    } else {
      sendMessage(`I choose: ${option}`);
    }
  }

  if (!groupChatId) {
    return <EmptyState />;
  }

  return (
    <div className="chat-page">
      <ChatHeader
        chat={chat}
        loading={loading}
        connected={connected}
        inviteCopied={inviteCopied}
        onBack={onBack}
        onCopyInvite={copyInviteLink}
      />

      <MessageList
        messages={messages}
        loading={loading}
        error={error}
        currentUserId={currentUserId}
        agentThinking={agentThinking}
        activeAgentName={activeAgentName}
        onSelectPlanOption={handleSelectPlanOption}
        onSendMessage={sendMessage}
      />

      {/* Research panel — only when active job and socket ready */}
      {activeResearchJobId && socket && (
        <div className="px-4 py-2">
          <ResearchAgentPanel jobId={activeResearchJobId} socket={socket} />
        </div>
      )}

      <ChatInput
        connected={connected}
        sending={sending}
        onSend={sendMessage}
      />

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}