import { useBrainstormChat, useBrainstormIsNewConversation } from "@hooks/useBrainstormChat";
import { useBrainstormSendMessage } from "@hooks/useBrainstormSendMessage";
import { Chat } from "@components/chat/Chat";
import { BrainstormLandingPage, BrainstormConversationPage } from "@components/brainstorm";

/**
 * Brainstorm page (Landing page or Conversation based on chat state)
 */
export default function Brainstorm() {
  const chat = useBrainstormChat();
  const isNewConversation = useBrainstormIsNewConversation();
  const { sendMessage } = useBrainstormSendMessage();

  return (
    <Chat.Root chat={chat} onSubmit={sendMessage}>
      {isNewConversation ? <BrainstormLandingPage /> : <BrainstormConversationPage />}
    </Chat.Root>
  );
}
