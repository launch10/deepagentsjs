import { useBrainstormChat, useBrainstormIsNewConversation } from "@components/brainstorm/hooks";
import { useBrainstormSendMessage } from "@components/brainstorm/hooks";
import { Chat } from "@components/shared/chat/Chat";
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
