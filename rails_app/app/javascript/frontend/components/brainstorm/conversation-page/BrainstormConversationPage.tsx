import { useEffect, useState, useRef, useMemo } from "react";
import { Brainstorm } from "@shared";
import { useBrainstormChat } from "@hooks/useBrainstormChat";
import { useWorkflowSteps } from "@context/WorkflowStepsProvider";
import {
  useBrandPersonalizationStore,
  selectHasAnyPersonalizations,
} from "@stores/brandPersonalization";
import { useWebsite } from "@api/websites.hooks";
import { useChatContext } from "@components/chat/Chat";
import { BrainstormMessages } from "./chat/BrainstormMessages";
import { BrainstormInput } from "../shared/BrainstormInput";
import { BrandPersonalizationPanel } from "./brand-panel/BrandPersonalizationPanel";
import { BrainstormChatSkeleton } from "./chat/BrainstormChatSkeleton";

const SKELETON_DELAY_MS = 200;

/**
 * Compute the current question number from messages.
 * Finds the last AI message with a topic and returns its question number.
 */
function computeQuestionNumber(
  messages: { role: string; metadata?: { currentTopic?: string } }[]
): number {
  // Find the last topic mentioned in AI messages (reverse search)
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") {
      const topic = message.metadata?.currentTopic as Brainstorm.TopicName | undefined;
      if (topic) {
        return Brainstorm.getQuestionNumberForTopic(topic);
      }
    }
  }
  return 1; // Default to question 1
}

/**
 * Inner component that uses brand personalization store.
 * Chat.Root is provided by parent BrainstormChat component.
 */
function BrainstormConversationContent({
  contentVisible,
  currentQuestionNumber,
}: {
  contentVisible: boolean;
  currentQuestionNumber: number;
}) {
  const hasPersonalizations = useBrandPersonalizationStore(selectHasAnyPersonalizations);
  const setTheme = useBrandPersonalizationStore((s) => s.setTheme);

  // Load website data to check if a theme has been set
  const { data: website } = useWebsite();
  const hasInitializedThemeRef = useRef(false);

  // Initialize theme from website data (before checking hasPersonalizations)
  useEffect(() => {
    if (!hasInitializedThemeRef.current && website?.theme_id != null) {
      setTheme(website.theme_id);
      hasInitializedThemeRef.current = true;
    }
  }, [website?.theme_id, setTheme]);

  // Auto-open panel if we've reached question 5 or if any personalizations have been applied
  const shouldAutoOpen = currentQuestionNumber >= 5 || hasPersonalizations;

  return (
    <div
      className={`h-full flex flex-col transition-opacity duration-300 ease-out ${
        contentVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex-1 min-h-0 overflow-hidden mx-auto container max-w-7xl grid grid-cols-1 lg:grid-cols-[288px_1fr] gap-8 px-8">
        {/* Left sidebar - Brand Personalization Panel */}
        <div className="hidden lg:block pt-[46px]">
          <BrandPersonalizationPanel shouldAutoOpen={shouldAutoOpen} className="sticky top-24" />
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
  // Use context for messages (Chat.Root provided by BrainstormChat)
  const { messages } = useChatContext();

  // Get additional values from brainstorm-specific hook
  const chat = useBrainstormChat();
  const { threadId, isLoadingHistory, state } = chat;
  const redirect = state.redirect;

  // Compute current question number from messages (memoized)
  const currentQuestionNumber = useMemo(() => computeQuestionNumber(messages), [messages]);

  // Determine if we're waiting for history to load
  const isEmpty = messages.length === 0;
  const isLoading = isLoadingHistory || isEmpty;

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

  // Get workflow store actions
  const workflowContinue = useWorkflowSteps((s) => s.continue);
  const workflowSetPage = useWorkflowSteps((s) => s.setPage);

  // Handle redirect when brainstorm is complete
  // Backend returns redirect: "website" (a WorkflowPage) to authorize navigation
  useEffect(() => {
    if (redirect === "website" && threadId && workflowSetPage && workflowContinue) {
      // Sync projectUUID from chat state to workflow store (needed for new projects
      // where Inertia props don't have it yet due to pushState navigation)
      workflowSetPage("brainstorm", threadId, false);
      // Then navigate to next step
      workflowContinue();
    }
  }, [redirect, threadId, workflowSetPage, workflowContinue]);

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
      currentQuestionNumber={currentQuestionNumber}
    />
  );
}
