import { CardContent, CardFooter } from "@components/ui/card";
import { useAdsChat, useAdsChatIsReady, useAdsChatIsStreaming, useAdsChatIsLoadingHistory } from "@components/ads/hooks";
import { Chat } from "@components/shared/chat/Chat";
import { CreditExhaustionDetector } from "@components/credits";
import AdsChatMessages from "./ads-chat/AdsChatMessages";
import AdsChatInput from "./ads-chat/AdsChatInput";

export default function AdsChat() {
  const chat = useAdsChat();

  const isLoadingHistory = useAdsChatIsLoadingHistory();
  const isStreaming = useAdsChatIsStreaming();
  const isReady = useAdsChatIsReady();

  return (
    <Chat.Root chat={chat}>
      <CreditExhaustionDetector />
      <div
        className="bg-background rounded-b-2xl  flex flex-col"
        data-testid="ads-chat"
        data-loading-history={isLoadingHistory}
        data-streaming={isStreaming}
        data-ready={isReady}
      >
        <CardContent className="flex-1 overflow-y-auto px-4 py-4 max-h-[300px]" data-testid="ads-chat-messages">
          <AdsChatMessages />
        </CardContent>
        <CardFooter className="flex-col gap-1 px-4 pb-4 pt-0 items-start">
          <AdsChatInput />
        </CardFooter>
      </div>
    </Chat.Root>
  );
}
