import type { ReactNode } from "react";
import type { UIMessage } from "ai";
import type { ChatActions, LanggraphChat } from "langgraph-ai-sdk-react";
import { ChatProvider } from "./ChatContext";

export interface RootProps<TState extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * The chat instance (from createChat or useBrainstormChat).
   *
   * The chat instance is stable - it's created once and reused.
   * Child components subscribe to specific pieces via useChatContextSelector.
   */
  chat: LanggraphChat<UIMessage, TState>;
  /** Child components that will have access to chat context */
  children: ReactNode;
  /** Optional className for the root container */
  className?: string;
  /**
   * Optional custom submit handler for all Chat.Input components.
   * Use this to wrap sendMessage with additional behavior (e.g., workflow sync).
   * If not provided, components use the chat's sendMessage directly.
   */
  onSubmit?: ChatActions<TState>["sendMessage"];
}

/**
 * Chat.Root - Provides chat context to all child components.
 *
 * Pass in your chat instance (from createChat or similar) and all Chat.*
 * subcomponents will have access to messages, composer, status, and actions
 * without prop drilling.
 *
 * The context stores the chat INSTANCE (stable), not a snapshot.
 * Child components use useChatContextSelector to subscribe to specific
 * pieces of data, achieving fine-grained reactivity.
 *
 * @example
 * ```tsx
 * function BrainstormPage() {
 *   const chat = useBrainstormChat(); // or createChat(...)
 *
 *   return (
 *     <Chat.Root chat={chat}>
 *       <BrainstormMessages />
 *       <BrainstormInput />
 *     </Chat.Root>
 *   );
 * }
 * ```
 */
export function Root<TState extends Record<string, unknown>>({
  chat,
  children,
  className,
  onSubmit,
}: RootProps<TState>) {
  return (
    <ChatProvider chat={chat} onSubmit={onSubmit}>
      {className ? <div className={className}>{children}</div> : children}
    </ChatProvider>
  );
}
