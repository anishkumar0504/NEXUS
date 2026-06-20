// src/components/chat/ChatPage.tsx
import { useGroupChat } from "../../hooks/useGroupChat";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";

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
  } = useGroupChat(groupChatId, token, currentUserId);

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
/>

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