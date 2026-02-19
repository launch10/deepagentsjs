import { useEffect, useState, useRef } from "react";
import { useBrainstormSelector } from "@components/brainstorm/hooks";
import { BrainstormMessages } from "./chat/BrainstormMessages";
import { BrainstormInput } from "../shared/BrainstormInput";
import { BrandPersonalizationPanel } from "./brand-panel/BrandPersonalizationPanel";
import { BrainstormChatSkeleton } from "./chat/BrainstormChatSkeleton";
import { PaginationFooter } from "@components/shared/pagination-footer";
import { useNavigateIntentHandler } from "@hooks/useNavigateIntentHandler";

const SKELETON_DELAY_MS = 200;

/**
 * Inner component for brainstorm conversation content.
 * Chat.Root is provided by parent BrainstormChat component.
 */
function BrainstormConversationContent({
  contentVisible,
}: {
  contentVisible: boolean;
}) {
  // Can continue when all conversational topics are done (lookAndFeel = last topic)
  const currentTopic = useBrainstormSelector((s) => s.state.currentTopic);
  const canContinue = currentTopic === "lookAndFeel";

  return (
    <div
      className={`h-full flex flex-col transition-opacity duration-300 ease-out ${
        contentVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex-1 min-h-0 overflow-hidden mx-auto container max-w-7xl grid grid-cols-1 lg:grid-cols-[288px_1fr] gap-8 px-8">
        {/* Left sidebar - Brand Personalization Panel */}
        <div className="hidden lg:block pt-[46px]">
          <BrandPersonalizationPanel className="sticky top-24" />
        </div>

        {/* Main chat area */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          {/* Scrollable messages area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <BrainstormMessages />
          </div>
          {/* Fixed bottom input area */}
          <div className="shrink-0 bg-neutral-background">
            <BrainstormInput />
          </div>
        </div>
      </div>

      {/* Pagination Footer */}
      <PaginationFooter.Root layout="container" canGoBack={false} canGoForward={canContinue}>
        <div /> {/* Empty div for left side since no back button */}
        <PaginationFooter.Actions>
          <PaginationFooter.ContinueButton disabled={!canContinue}>
            {canContinue ? "Build My Site" : "Continue"}
          </PaginationFooter.ContinueButton>
        </PaginationFooter.Actions>
      </PaginationFooter.Root>
    </div>
  );
}

/**
 * View for existing brainstorm conversations.
 * Uses delayed skeleton + fade transitions for smooth loading UX:
 * - Fast loads (<200ms): No skeleton, content fades in
 * - Slow loads (>200ms): Skeleton appears, then crossfades to content
 *
 * Chat.Root is provided by parent BrainstormChat component.
 */
export function BrainstormConversationPage() {
  // Navigate intent handler — inside both Chat.Root and WorkflowProvider
  useNavigateIntentHandler();

  const isLoadingHistory = useBrainstormSelector((s) => s.isLoadingHistory);

  // Determine if we're waiting for history to load
  const isLoading = isLoadingHistory;

  // Delayed skeleton: only show after SKELETON_DELAY_MS
  const [showSkeleton, setShowSkeleton] = useState(false);
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if content has ever been ready (for fade-in animation)
  const [contentVisible, setContentVisible] = useState(false);

  useEffect(() => {
    let rafId: number | undefined;

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
      rafId = requestAnimationFrame(() => {
        setContentVisible(true);
      });
    }

    return () => {
      if (skeletonTimerRef.current) {
        clearTimeout(skeletonTimerRef.current);
      }
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isLoading]);

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

  return (
    <BrainstormConversationContent
      contentVisible={contentVisible}
    />
  );
}
