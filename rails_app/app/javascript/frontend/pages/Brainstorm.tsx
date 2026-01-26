import { useBrainstormChat, useBrainstormIsNewConversation, useBrainstormSelector } from "@components/brainstorm/hooks";
import { Chat } from "@components/shared/chat/Chat";
import { CreditExhaustionDetector, CreditStatusWatcher } from "@components/credits";
import { BrainstormConversationPage, BrainstormLandingPage } from "@components/brainstorm";

function BrainstormCreditStatusWatcher() {
  const creditStatus = useBrainstormSelector((s) => s.state.creditStatus);
  return <CreditStatusWatcher creditStatus={creditStatus} />;
}

export default function Brainstorm() {
  // Just get a stable reference to the chat, so we don't re-render the whole page
  // every time the chat state changes
  const chat = useBrainstormChat();
  const isNewConversation = useBrainstormIsNewConversation();

  return (
    <Chat.Root chat={chat}>
      <CreditExhaustionDetector />
      <BrainstormCreditStatusWatcher />
      {isNewConversation ? <BrainstormLandingPage /> : <BrainstormConversationPage />}
    </Chat.Root>
  );
}
