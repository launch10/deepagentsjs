import { router } from "@inertiajs/react";
import {
  useBrainstormChatMessages,
  useBrainstormChatStatus,
  useBrainstormChatThreadId,
} from "@hooks/useBrainstormChat";
import { Chat } from "@components/chat";
import { useBrainstormInput } from "./BrainstormInputContext";

/**
 * Command buttons shown after AI response.
 * Fetches state directly via hooks.
 */
export function BrainstormCommandButtons() {
  const messages = useBrainstormChatMessages();
  const status = useBrainstormChatStatus();
  const { setInput, textareaRef } = useBrainstormInput();
  const threadId = useBrainstormChatThreadId();

  const isStreaming = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;
  const lastMessageIsAI = messages[messages.length - 1]?.role === "assistant";

  // Only show after streaming ends on last AI message
  if (isStreaming || !hasMessages || !lastMessageIsAI) {
    return null;
  }

  return (
    <div className="px-4">
      <Chat.CommandButtons.Root className="mt-4">
        <Chat.CommandButtons.Button
          variant="primary"
          onClick={() => {
            if (threadId) {
              router.visit(`/projects/${threadId}/website`);
            }
          }}
        >
          Show Landing Page
        </Chat.CommandButtons.Button>
        <Chat.CommandButtons.Button
          onClick={() => {
            setInput("Let's continue refining this idea...");
            textareaRef.current?.focus();
          }}
        >
          Continue Brainstorming
        </Chat.CommandButtons.Button>
      </Chat.CommandButtons.Root>
    </div>
  );
}
