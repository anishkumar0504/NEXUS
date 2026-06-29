// src/components/chat/ChatPage.tsx
import { useGroupChat } from "../../hooks/useGroupChat";
import { ResearchAgentPanel } from "../ResearchAgentPanel";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";
import { useEffect, useState, useMemo } from "react";

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

  // Track active research jobs directly from socket events
  const [researchJobId, setResearchJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    const handleStep = (data: any) => {
      console.log("[ChatPage] research:step:", data);
      setResearchJobId(data.jobId);
    };

    const handleComplete = (data: any) => {
      console.log("[ChatPage] research:complete:", data);
      // Clear after 3 seconds
      setTimeout(() => setResearchJobId((prev) => 
        prev === data.jobId ? null : prev
      ), 3000);
    };

    const handleError = (data: any) => {
      console.log("[ChatPage] research:error:", data);
      setTimeout(() => setResearchJobId((prev) => 
        prev === data.jobId ? null : prev
      ), 3000);
    };

    socket.on("research:step", handleStep);
    socket.on("research:complete", handleComplete);
    socket.on("research:error", handleError);

    return () => {
      socket.off("research:step", handleStep);
      socket.off("research:complete", handleComplete);
      socket.off("research:error", handleError);
    };
  }, [socket]);

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
console.log("socket:", socket, "researchJobId:", researchJobId);
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
  agentThinking={agentThinking || !!researchJobId}  // ← add this
  activeAgentName={activeAgentName}
  onSelectPlanOption={handleSelectPlanOption}
  onSendMessage={sendMessage}
/>

      {/* Research panel — shows when active research job */}
    {researchJobId && socket && (
  <div className="px-4 py-2">
    <ResearchAgentPanel jobId={researchJobId} socket={socket} />
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