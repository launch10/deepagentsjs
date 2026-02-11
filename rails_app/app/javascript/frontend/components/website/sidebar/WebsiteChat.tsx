import { CardContent, CardFooter } from "@components/ui/card";
import { useWebsiteChatIsLoadingHistory, useWebsiteChatActions } from "@hooks/website";
import { useWebsitePreview } from "@hooks/website";
import WebsiteChatInput from "./chat/WebsiteChatInput";
import WebsiteChatMessages from "./chat/WebsiteChatMessages";
import { useChatIsStreaming } from "@components/shared/chat/ChatContext";
import { twMerge } from "tailwind-merge";
import { useCallback } from "react";
import { useCurrentUser } from "@stores/sessionStore";

export interface WebsiteChatProps {
  /** When true, the chat input is disabled and shows a muted state */
  locked?: boolean;
}

/**
 * Prompt shown above the chat input when build errors are detected.
 * Clicking "Fix errors" sends a message to the agent with the error details.
 */
function BuildErrorPrompt() {
  const { consoleErrors } = useWebsitePreview();
  const { sendMessage } = useWebsiteChatActions();
  const isStreaming = useChatIsStreaming();
  const currentUser = useCurrentUser();

  const errors = consoleErrors.filter((e) => e.type === "error");

  const handleFix = useCallback(() => {
    sendMessage(
      "My page isn't displaying correctly, can you fix it?",
      { consoleErrors: errors }
    );
  }, [errors, sendMessage]);

  if (errors.length === 0 || isStreaming) return null;

  const isAdmin = currentUser?.admin ?? false;

  return (
    <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 w-full">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-red-700">
          We ran into an issue building your page
        </p>
        {isAdmin && (
          <p className="text-xs text-red-500 mt-0.5 truncate">
            {errors[0].message}
            {errors.length > 1 && ` (+${errors.length - 1} more)`}
          </p>
        )}
      </div>
      <button
        onClick={handleFix}
        className="shrink-0 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Fix errors
      </button>
    </div>
  );
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
        <BuildErrorPrompt />
        <WebsiteChatInput disabled={locked} />
      </CardFooter>
    </div>
  );
}
