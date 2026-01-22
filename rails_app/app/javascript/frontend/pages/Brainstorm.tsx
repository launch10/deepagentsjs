import { usePage } from "@inertiajs/react";
import { useBrainstormChat, useBrainstormIsNewConversation } from "@components/brainstorm/hooks";
import { Chat } from "@components/shared/chat/Chat";
import { BrainstormConversationPage, BrainstormLandingPage } from "@components/brainstorm";
import { useSyncPageProps } from "~/stores/useSyncCoreEntities";

export default function Brainstorm() {
  useSyncPageProps(usePage().props);

  // Just get a stable reference to the chat, so we don't re-render the whole page 
  // every time the chat state changes
  const chat = useBrainstormChat();
  const isNewConversation = useBrainstormIsNewConversation();

  return (
    <Chat.Root chat={chat}> {/** Child components subscribe to the chat state they need */}
      {isNewConversation ? <BrainstormLandingPage /> : <BrainstormConversationPage />}
    </Chat.Root>
  );
}
