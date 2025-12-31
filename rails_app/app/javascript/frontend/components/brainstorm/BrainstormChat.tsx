import { useBrainstormChat, useBrainstormIsNewConversation } from "@hooks/useBrainstormChat";
import { useBrainstormSendMessage } from "@hooks/useBrainstormSendMessage";
import { Chat } from "@components/chat";
import { BrainstormLanding } from "./BrainstormLanding";
import { BrainstormConversation } from "./BrainstormConversation";

/**
 * Main brainstorm chat component.
 * Routes between landing page (new conversation) and conversation view (existing).
 * The decision is based on whether a thread_id was provided by the server.
 *
 * Chat.Root is placed here so both BrainstormLanding and BrainstormConversation
 * have access to the chat context (composer, messages, etc.).
 *
 * The onSubmit prop passes the workflow-synced sendMessage to all Chat.Input
 * components, so they automatically trigger workflow state updates.
 */
export function BrainstormChat() {
  const chat = useBrainstormChat();
  const isNewConversation = useBrainstormIsNewConversation();
  const { sendMessage } = useBrainstormSendMessage();

  return (
    <Chat.Root chat={chat} onSubmit={sendMessage}>
      {isNewConversation ? <BrainstormLanding /> : <BrainstormConversation />}
    </Chat.Root>
  );
}
