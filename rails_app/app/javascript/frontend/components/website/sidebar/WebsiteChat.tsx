import { CardContent, CardFooter } from "@components/ui/card";
import { useWebsiteChatIsLoadingHistory } from "@hooks/website";
import WebsiteChatInput from "./chat/WebsiteChatInput";
import WebsiteChatMessages from "./chat/WebsiteChatMessages";
import { useChatIsStreaming } from "@components/shared/chat/ChatContext";
import { twMerge } from "tailwind-merge";

export interface WebsiteChatProps {
  /** When true, the chat input is disabled and shows a muted state */
  locked?: boolean;
}

/**
 * Website chat component following the same pattern as AdsChat.
 * Uses Chat compound components for consistent styling.
 */
export default function WebsiteChat({ locked = false }: WebsiteChatProps) {
  // Use chat context for messages/streaming, domain hook for isLoadingHistory
  const isStreaming = useChatIsStreaming();
  const isLoadingHistory = useWebsiteChatIsLoadingHistory();

  return (
    <div
      className={twMerge(
        "bg-neutral-background rounded-b-2xl flex flex-col flex-1 min-h-0 justify-between",
        locked && "opacity-60"
      )}
      data-testid="website-chat"
      data-loading-history={isLoadingHistory}
      data-streaming={isStreaming}
      data-locked={locked}
    >
      <CardContent
        className="flex-1 overflow-y-auto px-4 py-4 min-h-0"
        data-testid="website-chat-messages"
      >
        <WebsiteChatMessages />
      </CardContent>
      <CardFooter className="flex-col gap-1 px-4 pb-4 pt-0 w-full shrink-0">
        <WebsiteChatInput disabled={locked} />
      </CardFooter>
    </div>
  );
}
