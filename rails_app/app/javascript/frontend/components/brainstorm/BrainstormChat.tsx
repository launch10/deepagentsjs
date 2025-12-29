import { useEffect, useRef } from "react";
import { router } from "@inertiajs/react";
import {
  useBrainstormChatIsLoadingHistory,
  useBrainstormChatState,
  useBrainstormChatThreadId,
  useBrainstormIsNewConversation,
} from "@hooks/useBrainstormChat";
import { BrainstormInputProvider } from "./BrainstormInputContext";
import { BrainstormTopic } from "./BrainstormTopic";
import { BrainstormMessages } from "./BrainstormMessages";
import { BrainstormInput } from "./BrainstormInput";
import { BrainstormCommandButtons } from "./BrainstormCommandButtons";

/**
 * Main brainstorm chat component.
 * Handles URL updates, redirects, and loading state.
 * Child components fetch their own data via hooks.
 */
export function BrainstormChat() {
  const threadId = useBrainstormChatThreadId();
  const isLoadingHistory = useBrainstormChatIsLoadingHistory();
  const redirect = useBrainstormChatState("redirect");
  const isNewConversation = useBrainstormIsNewConversation();

  // Track if we've already updated the URL
  const hasUpdatedUrl = useRef(!isNewConversation);

  // Update URL when SDK provides threadId (after first message)
  useEffect(() => {
    if (threadId && isNewConversation && !hasUpdatedUrl.current) {
      const newUrl = `/projects/${threadId}/brainstorm`;
      window.history.replaceState({}, "", newUrl);
      hasUpdatedUrl.current = true;
    }
  }, [threadId, isNewConversation]);

  // Handle redirect when brainstorm is complete
  useEffect(() => {
    if (redirect === "website_builder" && threadId) {
      router.visit(`/projects/${threadId}/website`);
    }
  }, [redirect, threadId]);

  // Loading state
  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-neutral-500">Loading conversation...</div>
      </div>
    );
  }

  return (
    <BrainstormInputProvider>
      <div className="flex flex-col h-screen max-w-2xl mx-auto">
        <BrainstormTopic />
        <BrainstormMessages />
        <BrainstormCommandButtons />
        <BrainstormInput />
      </div>
    </BrainstormInputProvider>
  );
}
