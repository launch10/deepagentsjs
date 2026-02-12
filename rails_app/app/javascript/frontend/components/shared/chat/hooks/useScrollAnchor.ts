import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export interface UseScrollAnchorOptions {
  /** Distance from bottom (px) to consider "at bottom". @default 50 */
  threshold?: number;
  /** Scroll behavior when programmatically scrolling. @default "smooth" */
  behavior?: ScrollBehavior;
}

export interface UseScrollAnchorReturn {
  shouldAutoScroll: boolean;
  newMessageCount: number;
  scrollToBottom: () => void;
}

/**
 * Manages auto-scroll behavior for chat message lists.
 *
 * - Auto-scrolls to the anchor when new messages arrive (default behavior).
 * - Detects when the user scrolls up and pauses auto-scroll.
 * - Tracks how many messages arrived while paused (`newMessageCount`).
 * - Re-enables auto-scroll when the user scrolls back to bottom or calls `scrollToBottom`.
 * - Uses a guard flag to ignore programmatic scrolls.
 */
export function useScrollAnchor(
  containerRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<HTMLElement | null>,
  messages: unknown[],
  options: UseScrollAnchorOptions = {}
): UseScrollAnchorReturn {
  const { threshold = 50, behavior = "smooth" } = options;

  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);

  // Guard flag to distinguish programmatic vs user scrolls
  const isProgrammaticScroll = useRef(false);
  // Track previous message count to detect new messages
  const prevMessageCount = useRef(messages.length);

  // Check if scroll container is near the bottom
  const isNearBottom = useCallback(
    (el: HTMLElement) => {
      return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    },
    [threshold]
  );

  // Scroll to bottom and re-enable auto-scroll
  const scrollToBottom = useCallback(() => {
    if (!anchorRef.current) return;
    isProgrammaticScroll.current = true;
    anchorRef.current.scrollIntoView({ behavior });

    // Clear guard after scroll settles (scrollend with setTimeout fallback)
    const clearGuard = () => {
      isProgrammaticScroll.current = false;
    };
    const container = containerRef.current;
    if (container) {
      const onScrollEnd = () => {
        clearGuard();
        container.removeEventListener("scrollend", onScrollEnd);
      };
      container.addEventListener("scrollend", onScrollEnd, { once: true });
    }
    // Fallback in case scrollend doesn't fire (e.g. already at bottom, or no native support)
    setTimeout(clearGuard, 500);

    setShouldAutoScroll(true);
    setNewMessageCount(0);
  }, [anchorRef, containerRef, behavior]);

  // Listen for scroll events on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Ignore programmatic scrolls
      if (isProgrammaticScroll.current) return;

      const nearBottom = isNearBottom(container);

      if (nearBottom) {
        // User scrolled back to bottom — re-enable
        setShouldAutoScroll(true);
        setNewMessageCount(0);
      } else {
        // User scrolled away from bottom — pause
        setShouldAutoScroll(false);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef, isNearBottom]);

  // Auto-scroll or count new messages when messages change
  useEffect(() => {
    const currentCount = messages.length;
    const prevCount = prevMessageCount.current;
    const newMessages = currentCount - prevCount;
    prevMessageCount.current = currentCount;

    if (shouldAutoScroll) {
      if (!anchorRef.current) return;
      isProgrammaticScroll.current = true;
      anchorRef.current.scrollIntoView({ behavior });

      const clearGuard = () => {
        isProgrammaticScroll.current = false;
      };
      const container = containerRef.current;
      if (container) {
        const onScrollEnd = () => {
          clearGuard();
          container.removeEventListener("scrollend", onScrollEnd);
        };
        container.addEventListener("scrollend", onScrollEnd, { once: true });
      }
      setTimeout(clearGuard, 500);
    } else if (newMessages > 0) {
      setNewMessageCount((c) => c + newMessages);
    }
  }, [messages, shouldAutoScroll, anchorRef, containerRef, behavior]);

  return { shouldAutoScroll, newMessageCount, scrollToBottom };
}
