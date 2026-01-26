import { useChatError } from "@components/shared/chat/ChatContext";
import { useCreditExhaustionDetector } from "~/hooks/useCreditExhaustionDetector";

/**
 * A component that detects credit exhaustion errors from chat state.
 *
 * Place this inside a Chat.Root to automatically detect when the API
 * returns a 402 "Insufficient credits" error and update the credit store.
 *
 * This triggers the ExhaustionModal to show and locks chat inputs.
 *
 * @example
 * ```tsx
 * <Chat.Root chat={chat}>
 *   <CreditExhaustionDetector />
 *   <ChatMessages />
 *   <ChatInput />
 * </Chat.Root>
 * ```
 */
export function CreditExhaustionDetector(): null {
  const error = useChatError();
  useCreditExhaustionDetector(error);

  // This component renders nothing - it's just for side effects
  return null;
}
