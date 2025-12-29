import { useEffect, useState, useRef } from "react";
import { router } from "@inertiajs/react";
import {
  useBrainstormChatIsLoadingHistory,
  useBrainstormChatMessages,
  useBrainstormChatState,
  useBrainstormChatThreadId,
} from "@hooks/useBrainstormChat";
import { BrainstormInputProvider } from "./BrainstormInputContext";
import { BrainstormMessages } from "./BrainstormMessages";
import { BrainstormInput } from "./BrainstormInput";
import { BrainstormCommandButtons } from "./BrainstormCommandButtons";
import { BrandPersonalizationPanel } from "./BrandPersonalizationPanel";
import { BrainstormChatSkeleton } from "./BrainstormChatSkeleton";

const SKELETON_DELAY_MS = 200;

/**
 * View for existing brainstorm conversations.
 * Uses delayed skeleton + fade transitions for smooth loading UX:
 * - Fast loads (<200ms): No skeleton, content fades in
 * - Slow loads (>200ms): Skeleton appears, then crossfades to content
 */
export function BrainstormConversation() {
  const threadId = useBrainstormChatThreadId();
  const isLoadingHistory = useBrainstormChatIsLoadingHistory();
  const redirect = useBrainstormChatState("redirect");
  const messages = useBrainstormChatMessages();

  // Determine if we're waiting for history to load
  const isEmpty = messages.length === 0;
  const isLoading = isLoadingHistory || isEmpty;

  // Delayed skeleton: only show after SKELETON_DELAY_MS
  const [showSkeleton, setShowSkeleton] = useState(false);
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if content has ever been ready (for fade-in animation)
  const [contentVisible, setContentVisible] = useState(false);

  useEffect(() => {
    if (isLoading) {
      // Start timer to show skeleton after delay
      skeletonTimerRef.current = setTimeout(() => {
        setShowSkeleton(true);
      }, SKELETON_DELAY_MS);
      setContentVisible(false);
    } else {
      // Loading finished - clear timer and hide skeleton
      if (skeletonTimerRef.current) {
        clearTimeout(skeletonTimerRef.current);
        skeletonTimerRef.current = null;
      }
      setShowSkeleton(false);
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => {
        setContentVisible(true);
      });
    }

    return () => {
      if (skeletonTimerRef.current) {
        clearTimeout(skeletonTimerRef.current);
      }
    };
  }, [isLoading]);

  // Handle redirect when brainstorm is complete
  useEffect(() => {
    if (redirect === "website_builder" && threadId) {
      router.visit(`/projects/${threadId}/website`);
    }
  }, [redirect, threadId]);

  // Show skeleton with fade (only if delay has passed)
  if (isLoading && showSkeleton) {
    return (
      <div className="transition-opacity duration-200 ease-out opacity-100">
        <BrainstormChatSkeleton />
      </div>
    );
  }

  // During loading before skeleton delay, show empty placeholder (prevents flash)
  if (isLoading) {
    return <div className="h-full" />;
  }

  // Content ready - fade in
  return (
    <div
      className={`transition-opacity duration-300 ease-out ${
        contentVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <BrainstormInputProvider>
        <div className="flex flex-col h-full min-h-0">
          <div className="flex flex-1 min-h-0">
            {/* Left sidebar - Brand Personalization Panel */}
            <div className="hidden lg:block p-4 shrink-0">
              <BrandPersonalizationPanel />
            </div>

            {/* Main chat area */}
            <div className="flex-1 flex flex-col min-h-0">
              <BrainstormMessages />
              <BrainstormCommandButtons />
              <BrainstormInput />
            </div>
          </div>
        </div>
      </BrainstormInputProvider>
    </div>
  );
}
