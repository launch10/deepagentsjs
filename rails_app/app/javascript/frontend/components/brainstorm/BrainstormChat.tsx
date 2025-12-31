import { useBrainstormChat, useBrainstormIsNewConversation } from "@hooks/useBrainstormChat";
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
 */
export function BrainstormChat() {
  const chat = useBrainstormChat();
  const isNewConversation = useBrainstormIsNewConversation();

  return (
    <Chat.Root chat={chat}>
      {isNewConversation ? <BrainstormLanding /> : <BrainstormConversation />}
    </Chat.Root>
  );
}
