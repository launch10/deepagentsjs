import { useEffect } from "react";
import { usePage } from "@inertiajs/react";
import { useBrainstormChat, useBrainstormIsNewConversation } from "@components/brainstorm/hooks";
import { Chat } from "@components/shared/chat/Chat";
import { BrainstormConversationPage, BrainstormLandingPage } from "@components/brainstorm";
import { useSyncPageProps } from "~/stores/useSyncCoreEntities";
import { syncBrainstormToLanggraphStore } from "@components/brainstorm/hooks";

export default function Brainstorm() {
  const pageProps = usePage().props;
  const chat = useBrainstormChat();
  const isNewConversation = useBrainstormIsNewConversation();

  useSyncPageProps(pageProps);
  syncBrainstormToLanggraphStore()

  return (
    <Chat.Root chat={chat}>
      {isNewConversation ? <BrainstormLandingPage /> : <BrainstormConversationPage />}
    </Chat.Root>
  );
}
