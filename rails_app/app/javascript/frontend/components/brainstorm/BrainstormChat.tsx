import { useBrainstormIsNewConversation } from "@hooks/useBrainstormChat";
import { BrainstormLanding } from "./BrainstormLanding";
import { BrainstormConversation } from "./BrainstormConversation";

/**
 * Main brainstorm chat component.
 * Routes between landing page (new conversation) and conversation view (existing).
 * The decision is based on whether a thread_id was provided by the server.
 */
export function BrainstormChat() {
  const isNewConversation = useBrainstormIsNewConversation();

  if (isNewConversation) {
    return <BrainstormLanding />;
  }

  return <BrainstormConversation />;
}
