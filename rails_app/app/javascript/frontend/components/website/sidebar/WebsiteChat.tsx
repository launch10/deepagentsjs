import { CardContent, CardFooter } from "@components/ui/card";
import { Chat, useChatContext } from "@components/shared/chat/Chat";
import WebsiteChatInput from "./chat/WebsiteChatInput";
import WebsiteChatMessages from "./chat/WebsiteChatMessages";

/**
 * Website chat component following the same pattern as AdsChat.
 * Uses Chat compound components for consistent styling.
 */
export default function WebsiteChat() {
  // Use chat context provided by Chat.Root in Website.tsx
  const { isLoadingHistory, isStreaming, messages } = useChatContext();

  const isReady = !isLoadingHistory && !isStreaming;
  // Show welcome message when website is ready and user hasn't sent any messages yet
  const hasUserMessages = messages.some((m) => m.role === "user");
  const showWelcomeMessage = isReady && !hasUserMessages;

  return (
    <div
      className="bg-neutral-background rounded-b-2xl flex flex-col flex-1 min-h-0 justify-between"
      data-testid="website-chat"
      data-loading-history={isLoadingHistory}
      data-streaming={isStreaming}
      data-ready={isReady}
    >
      <CardContent className="flex-1 overflow-y-auto px-4 py-4 min-h-0" data-testid="website-chat-messages">
        {showWelcomeMessage ? (
          <p className="text-xs text-base-500 leading-4">
            Your website is ready! Feel free to ask me for any changes.
          </p>
        ) : (
          <WebsiteChatMessages />
        )}
      </CardContent>
      <CardFooter className="flex-col gap-1 px-4 pb-4 pt-0 w-full shrink-0">
        <WebsiteChatInput />
      </CardFooter>
    </div>
  );
}
