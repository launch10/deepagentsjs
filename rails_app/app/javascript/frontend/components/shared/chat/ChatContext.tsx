import { createContext, useContext, useMemo, useEffect, useRef, type ReactNode } from "react";
import type { UIMessage } from "ai";
import type { ChatSnapshot, ChatActions, LanggraphChat } from "langgraph-ai-sdk-react";
import { useChatSelector, ChatSelectors } from "langgraph-ai-sdk-react";
import type { Composer, AnyMessageWithBlocks } from "langgraph-ai-sdk-types";
import type { CreditStatus } from "@shared";
import { useCreditStore } from "~/stores/creditStore";

/**
 * Chat context value - stores the chat INSTANCE (stable reference).
 *
 * The chat instance is the source of truth. It's stable across renders,
 * so the context value itself doesn't cause re-renders.
 *
 * Child components use `useChatContextSelector` to subscribe to specific
 * pieces of data, achieving fine-grained reactivity.
 */
export interface ChatContextValue<
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  /** The chat instance (stable reference) */
  chat: LanggraphChat<UIMessage, TState>;
  /** Optional custom submit handler for Chat.Input components */
  onSubmit?: ChatActions<TState>["sendMessage"];
}

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Get the chat instance from context.
 * Use this when you need direct access to the chat or to pass it to useChatSelector.
 *
 * @throws Error if used outside Chat.Root
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const chat = useChatFromContext();
 *   const messages = useChatSelector(chat, s => s.messages);
 * }
 * ```
 */
export function useChatFromContext<
  TState extends Record<string, unknown> = Record<string, unknown>,
>(): LanggraphChat<UIMessage, TState> {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatFromContext must be used within Chat.Root");
  }
  return ctx.chat as LanggraphChat<UIMessage, TState>;
}

/**
 * Subscribe to a specific piece of chat state using a selector.
 * This is the recommended way to access chat data in components.
 *
 * Components only re-render when the selected data changes (shallow equality).
 *
 * @example
 * ```tsx
 * function MessageList() {
 *   const messages = useChatContextSelector(s => s.messages);
 *   // Only re-renders when messages change
 * }
 *
 * function StatusIndicator() {
 *   const isStreaming = useChatContextSelector(s => s.status === 'streaming' || s.status === 'submitted');
 *   // Only re-renders when streaming state changes
 * }
 * ```
 */
export function useChatContextSelector<
  TState extends Record<string, unknown> = Record<string, unknown>,
  TSelected = unknown,
>(selector: (snapshot: ChatSnapshot<TState>) => TSelected): TSelected {
  const chat = useChatFromContext<TState>();
  return useChatSelector(chat, selector);
}

/**
 * Convenience hooks for common patterns.
 * These use the pre-built ChatSelectors for optimal performance.
 */

export function useChatMessages() {
  return useChatContextSelector(ChatSelectors.messages);
}

export function useChatComposer() {
  return useChatContextSelector(ChatSelectors.composer);
}

export function useChatStatus() {
  return useChatContextSelector(ChatSelectors.status);
}

export function useChatIsStreaming() {
  return useChatContextSelector(ChatSelectors.isStreaming);
}

export function useChatIsLoading() {
  return useChatContextSelector(ChatSelectors.isLoading);
}

export function useChatIsReady() {
  return useChatContextSelector(ChatSelectors.isReady);
}

export function useChatActions<TState extends Record<string, unknown> = Record<string, unknown>>() {
  return useChatContextSelector<TState, ChatActions<TState>>(ChatSelectors.actions);
}

export function useChatError() {
  return useChatContextSelector(ChatSelectors.error);
}

export function useChatThreadId() {
  return useChatContextSelector(ChatSelectors.threadId);
}

export function useChatStop() {
  return useChatContextSelector(ChatSelectors.stop);
}

export function useChatState<
  TState extends Record<string, unknown> = Record<string, unknown>,
>(): Partial<TState> {
  return useChatContextSelector<TState, Partial<TState>>(ChatSelectors.state);
}

/**
 * Get the submit function, using custom onSubmit if provided to Chat.Root.
 * This is what Chat.Input components should use.
 */
export function useChatSubmit<TState extends Record<string, unknown> = Record<string, unknown>>() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatSubmit must be used within Chat.Root");
  }

  const actions = useChatContextSelector<TState, ChatActions<TState>>(ChatSelectors.actions);

  // If custom onSubmit is provided, use it; otherwise use default sendMessage
  return ctx.onSubmit ?? (() => actions.sendMessage());
}

export interface ChatProviderProps<TState extends Record<string, unknown>> {
  /** The chat instance (from createChat or similar) */
  chat: LanggraphChat<UIMessage, TState>;
  children: ReactNode;
  /**
   * Optional custom submit handler. When provided, all Chat.Input components
   * will use this instead of the chat's sendMessage for submit actions.
   * Useful for wrapping sendMessage with additional behavior (e.g., workflow sync).
   */
  onSubmit?: ChatActions<TState>["sendMessage"];
}

/**
 * Internal hook that watches for out-of-credits state.
 * Handles both:
 * - 402 errors from middleware (pre-run rejection)
 * - creditStatus in stream (ran out mid-run)
 *
 * This is called automatically by ChatProvider, so pages don't need
 * to manually wire up credit detection.
 */
function useCreditIntegration<TState extends Record<string, unknown>>(
  chat: LanggraphChat<UIMessage, TState>
) {
  const updateFromCreditStatus = useCreditStore((s) => s.updateFromCreditStatus);
  const updateFromBalanceCheck = useCreditStore((s) => s.updateFromBalanceCheck);
  const showModal = useCreditStore((s) => s.showModal);

  // Track last processed to avoid duplicate updates
  const lastProcessedRef = useRef<string | null>(null);

  // Watch for 402 errors (pre-run rejection)
  const error = useChatSelector(chat, ChatSelectors.error);

  useEffect(() => {
    if (!error) return;
    const message = error.message || "";

    if (message.includes("CREDITS_EXHAUSTED") || message.includes("Insufficient credits")) {
      try {
        const parsed = JSON.parse(message);
        if (parsed.code === "CREDITS_EXHAUSTED") {
          updateFromBalanceCheck({
            balanceMillicredits: parsed.balance ?? 0,
            planMillicredits: parsed.planCredits ?? 0,
            packMillicredits: parsed.packCredits ?? 0,
            isExhausted: true,
          });
          showModal();
        }
      } catch {
        // If we can't parse, just mark as exhausted and show modal
        updateFromBalanceCheck({
          balanceMillicredits: 0,
          planMillicredits: 0,
          packMillicredits: 0,
          isExhausted: true,
        });
        showModal();
      }
    }
  }, [error, updateFromBalanceCheck, showModal]);

  // Watch for creditStatus in stream (ran out mid-run)
  const creditStatus = useChatSelector(
    chat,
    (s) => (s.state as { creditStatus?: CreditStatus })?.creditStatus
  );

  useEffect(() => {
    if (!creditStatus) return;

    // Create a fingerprint to detect changes and avoid duplicate processing
    const fingerprint = `${creditStatus.preRunMillicredits}-${creditStatus.estimatedCostMillicredits}`;
    if (lastProcessedRef.current === fingerprint) return;
    lastProcessedRef.current = fingerprint;

    updateFromCreditStatus({
      estimatedCreditsRemaining: creditStatus.estimatedRemainingMillicredits,
      justExhausted: creditStatus.justExhausted,
    });
  }, [creditStatus, updateFromCreditStatus]);
}

/**
 * Internal provider component - used by Chat.Root.
 * The context value is stable (chat instance + optional onSubmit),
 * so it doesn't cause unnecessary re-renders.
 *
 * Automatically integrates out-of-credits detection - no manual wiring needed.
 */
export function ChatProvider<TState extends Record<string, unknown>>({
  chat,
  children,
  onSubmit,
}: ChatProviderProps<TState>) {
  // Automatic credit integration - watches for 402 errors and creditStatus in stream
  useCreditIntegration(chat);

  // Create a stable context value - the chat instance is stable,
  // and onSubmit should be memoized by the caller
  const value = useMemo<ChatContextValue<TState>>(() => ({ chat, onSubmit }), [chat, onSubmit]);

  return <ChatContext.Provider value={value as ChatContextValue}>{children}</ChatContext.Provider>;
}

// Re-export the context for testing purposes
export { ChatContext };
