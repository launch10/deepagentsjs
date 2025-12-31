import { useEffect, useState, useRef, useMemo } from "react";
import { router } from "@inertiajs/react";
import { Brainstorm } from "@shared";
import { useBrainstormChat, type BrainstormSnapshot } from "@hooks/useBrainstormChat";
import {
  useBrandPersonalizationStore,
  selectHasAnyPersonalizations,
} from "@stores/brandPersonalization";
import { useWebsite } from "@api/websites.hooks";
import { Chat } from "@components/chat";
import { BrainstormMessages } from "./BrainstormMessages";
import { BrainstormInput } from "./BrainstormInput";
import { BrandPersonalizationPanel } from "./BrandPersonalizationPanel";
import { BrainstormChatSkeleton } from "./BrainstormChatSkeleton";

const SKELETON_DELAY_MS = 200;

/**
 * Compute the current question number from messages.
 * Finds the last AI message with a topic and returns its question number.
 */
function computeQuestionNumber(messages: BrainstormSnapshot["messages"]): number {
  // Find the last topic mentioned in AI messages (reverse search)
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") {
      const topic = (message as any).metadata?.currentTopic as Brainstorm.TopicName | undefined;
      if (topic) {
        return Brainstorm.getQuestionNumberForTopic(topic);
      }
    }
  }
  return 1; // Default to question 1
}

/**
 * Inner component that uses brand personalization store.
 * Wrapped in Chat.Root to provide context to all child components.
 */
function BrainstormConversationContent({
  chat,
  contentVisible,
  currentQuestionNumber,
}: {
  chat: BrainstormSnapshot;
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

          <Chat.Root chat={chat}>
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
          </Chat.Root>
        </div>
      </div>
  );
}

/**
 * View for existing brainstorm conversations.
 * Uses delayed skeleton + fade transitions for smooth loading UX:
 * - Fast loads (<200ms): No skeleton, content fades in
 * - Slow loads (>200ms): Skeleton appears, then crossfades to content
 */
export function BrainstormConversation() {
  // Get the full chat snapshot to pass to Chat.Root
  const chat = useBrainstormChat();

  // Extract values for loading logic
  const { threadId, isLoadingHistory, messages, state } = chat;
  const redirect = state.redirect;

  // Compute current question number from messages (memoized)
  const currentQuestionNumber = useMemo(
    () => computeQuestionNumber(messages),
    [messages]
  );

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

  // Chat.Root inside BrainstormConversationContent provides context to children
  return (
    <BrainstormConversationContent
      chat={chat}
      contentVisible={contentVisible}
      currentQuestionNumber={currentQuestionNumber}
    />
  );
}
