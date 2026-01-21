import { usePage } from "@inertiajs/react";
import {
  useBrainstormChat,
  useBrainstormIsNewConversation,
  useSyncBrainstormEntities,
} from "@components/brainstorm/hooks";
import { useBrainstormSendMessage } from "@components/brainstorm/hooks";
import { Chat } from "@components/shared/chat/Chat";
import { BrainstormLandingPage, BrainstormConversationPage } from "@components/brainstorm";
import { useSyncPageProps } from "~/stores/useSyncCoreEntities";

/**
 * Brainstorm page (Landing page or Conversation based on chat state)
 */
export default function Brainstorm() {
  const pageProps = usePage().props;
  const chat = useBrainstormChat();
  const isNewConversation = useBrainstormIsNewConversation();
  const { sendMessage } = useBrainstormSendMessage();

  // Sync page props (once on mount) and Langgraph entity IDs (individual keys)
  useSyncPageProps(pageProps);
  useSyncBrainstormEntities();

  return (
    <Chat.Root chat={chat} onSubmit={sendMessage}>
      {isNewConversation ? <BrainstormLandingPage /> : <BrainstormConversationPage />}
    </Chat.Root>
  );
}
