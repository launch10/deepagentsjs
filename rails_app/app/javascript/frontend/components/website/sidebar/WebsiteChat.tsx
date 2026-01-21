import { CardContent, CardFooter } from "@components/ui/card";
import { useWebsiteChatIsLoadingHistory } from "@hooks/website";
import WebsiteChatInput from "./chat/WebsiteChatInput";
import WebsiteChatMessages from "./chat/WebsiteChatMessages";
import { useChatMessages, useChatIsStreaming } from "@components/shared/chat/ChatContext";

/**
 * Website chat component following the same pattern as AdsChat.
 * Uses Chat compound components for consistent styling.
 */
export default function WebsiteChat() {
  // Use chat context for messages/streaming, domain hook for isLoadingHistory
  const isStreaming = useChatIsStreaming();
  const isLoadingHistory = useWebsiteChatIsLoadingHistory();

  return (
    <div
      className="bg-neutral-background rounded-b-2xl flex flex-col flex-1 min-h-0 justify-between"
      data-testid="website-chat"
      data-loading-history={isLoadingHistory}
      data-streaming={isStreaming}
    >
      <CardContent className="flex-1 overflow-y-auto px-4 py-4 min-h-0" data-testid="website-chat-messages">
        <WebsiteChatMessages />
      </CardContent>
      <CardFooter className="flex-col gap-1 px-4 pb-4 pt-0 w-full shrink-0">
        <WebsiteChatInput />
      </CardFooter>
    </div>
  );
}
