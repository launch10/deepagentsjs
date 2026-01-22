import { usePage } from "@inertiajs/react";
import { useBrainstormChat, useBrainstormIsNewConversation } from "@components/brainstorm/hooks";
import { Chat } from "@components/shared/chat/Chat";
import { BrainstormConversationPage, BrainstormLandingPage } from "@components/brainstorm";
import { useSyncPageProps } from "~/stores/useSyncCoreEntities";
import { syncBrainstormToCoreStore } from "@components/brainstorm/hooks";

export default function Brainstorm() {
  const pageProps = usePage().props;
  const chat = useBrainstormChat(); // Just get a stable reference to the chat, so we don't re-render the whole page every time the chat state changes
  const isNewConversation = useBrainstormIsNewConversation();

  useSyncPageProps(pageProps); // Initially, we get core data like projectId from page props
  syncBrainstormToCoreStore() // Then, updates will flow in from Langgraph to CoreStore, so any subscribers can get the latest values

  return (
    <Chat.Root chat={chat}> {/** Child components subscribe to the chat state they need */}
      {isNewConversation ? <BrainstormLandingPage /> : <BrainstormConversationPage />}
    </Chat.Root>
  );
}
