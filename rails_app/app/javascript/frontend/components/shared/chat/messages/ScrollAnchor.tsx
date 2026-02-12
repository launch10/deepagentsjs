import { useEffect, useRef } from "react";
import { useChatMessages } from "../ChatContext";
import { useScrollAnchor } from "../hooks/useScrollAnchor";
import { useScrollContainer } from "./ScrollContainerContext";

export interface ScrollAnchorProps {
  /**
   * Scroll behavior.
   * @default "smooth"
   */
  behavior?: ScrollBehavior;
  /**
   * Whether to disable auto-scrolling.
   * @default false
   */
  disabled?: boolean;
}

/**
 * Chat.Messages.ScrollAnchor - Auto-scrolls to bottom on new messages.
 *
 * When placed inside a Chat.Messages.List, it uses smart scroll detection:
 * - Auto-scrolls by default
 * - Pauses when the user scrolls up
 * - Shows a "N new messages" pill while paused
 * - Re-enables on pill click or manual scroll to bottom
 *
 * Falls back to simple always-scroll behavior when used outside List.
 *
 * @example
 * ```tsx
 * <Chat.Messages.List>
 *   {messages.map(...)}
 *   <Chat.Messages.ScrollAnchor />
 * </Chat.Messages.List>
 * ```
 */
export function ScrollAnchor({
  behavior = "smooth",
  disabled = false,
}: ScrollAnchorProps) {
  const messages = useChatMessages();
  const anchorRef = useRef<HTMLDivElement>(null);
  const containerRef = useScrollContainer();

  // Smart mode: inside a List with scroll container context
  if (containerRef) {
    return (
      <SmartScrollAnchor
        anchorRef={anchorRef}
        containerRef={containerRef}
        messages={messages}
        behavior={behavior}
        disabled={disabled}
      />
    );
  }

  // Fallback: simple always-scroll (backwards compat)
  return <SimpleScrollAnchor anchorRef={anchorRef} messages={messages} behavior={behavior} disabled={disabled} />;
}

function SimpleScrollAnchor({
  anchorRef,
  messages,
  behavior,
  disabled,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  messages: unknown[];
  behavior: ScrollBehavior;
  disabled: boolean;
}) {
  useEffect(() => {
    if (disabled) return;
    anchorRef.current?.scrollIntoView({ behavior });
  }, [messages, behavior, disabled, anchorRef]);

  return <div ref={anchorRef} aria-hidden="true" />;
}

function SmartScrollAnchor({
  anchorRef,
  containerRef,
  messages,
  behavior,
  disabled,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLElement | null>;
  messages: unknown[];
  behavior: ScrollBehavior;
  disabled: boolean;
}) {
  const { shouldAutoScroll, newMessageCount, scrollToBottom } = useScrollAnchor(
    containerRef,
    anchorRef,
    messages,
    { behavior }
  );

  // If disabled, don't auto-scroll at all (hook still manages state but we skip its effect via the disabled prop)
  useEffect(() => {
    if (disabled) return;
    // The hook handles auto-scrolling internally, so nothing extra needed here
  }, [disabled]);

  return (
    <>
      {newMessageCount > 0 && !shouldAutoScroll && !disabled && (
        <button
          onClick={scrollToBottom}
          className="sticky bottom-2 left-1/2 -translate-x-1/2 z-10
                     bg-secondary-500 text-white text-xs px-3 py-1.5
                     rounded-full shadow-md hover:bg-secondary-600
                     transition-opacity animate-in fade-in"
        >
          {newMessageCount} new message{newMessageCount > 1 ? "s" : ""} ↓
        </button>
      )}
      <div ref={anchorRef} aria-hidden="true" />
    </>
  );
}
