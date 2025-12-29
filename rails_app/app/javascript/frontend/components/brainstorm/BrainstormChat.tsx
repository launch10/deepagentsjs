import { useEffect, useRef } from "react";
import { router } from "@inertiajs/react";
import {
  useBrainstormChatIsLoadingHistory,
  useBrainstormChatMessages,
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
  const messages = useBrainstormChatMessages();

  // Track if we've already updated the URL
  const hasUpdatedUrl = useRef(!isNewConversation);

  // Check if this is the empty state (no messages)
  const isEmpty = messages.length === 0;

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
      <div className="flex flex-col h-full min-h-0">
        <BrainstormTopic />
        {isEmpty ? (
          // Empty state - center everything vertically
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-semibold mb-4 text-base-500 tracking-tight font-serif">
                Tell us your next <em className="italic">big idea</em>
              </h1>
              <p className="text-lg text-base-400 opacity-70 max-w-[616px] mx-auto leading-relaxed font-sans">
                Add as much detail as you want. The more you share, the more tailored your site and
                campaign will be. No design or tech skills needed.
              </p>
            </div>
            <div className="w-full max-w-[808px]">
              <BrainstormInput />
            </div>
          </div>
        ) : (
          // Has messages - normal layout
          <>
            <BrainstormMessages />
            <BrainstormCommandButtons />
            <BrainstormInput />
          </>
        )}
      </div>
    </BrainstormInputProvider>
  );
}
