import type { ReactNode } from "react";
import type { ChatSnapshot, ChatActions } from "langgraph-ai-sdk-react";
import { ChatProvider } from "./ChatContext";

export interface RootProps<TState extends Record<string, unknown> = Record<string, unknown>> {
  /** The chat snapshot from useBrainstormChat, useAdsChat, or similar hook */
  chat: ChatSnapshot<TState>;
  /** Child components that will have access to chat context */
  children: ReactNode;
  /** Optional className for the root container */
  className?: string;
  /**
   * Optional custom submit handler for all Chat.Input components.
   * Use this to wrap sendMessage with additional behavior (e.g., workflow sync).
   * If not provided, components use the snapshot's sendMessage directly.
   */
  onSubmit?: ChatActions<TState>["sendMessage"];
}

/**
 * Chat.Root - Provides chat context to all child components.
 *
 * Pass in your chat snapshot and all Chat.* subcomponents will have
 * access to messages, composer, status, and actions without prop drilling.
 *
 * @example
 * ```tsx
 * const chat = useBrainstormChat();
 *
 * <Chat.Root chat={chat}>
 *   <BrainstormMessages />
 *   <BrainstormInput />
 * </Chat.Root>
 * ```
 */
export function Root<TState extends Record<string, unknown>>({
  chat,
  children,
  className,
  onSubmit,
}: RootProps<TState>) {
  return (
    <ChatProvider snapshot={chat} onSubmit={onSubmit}>
      {className ? <div className={className}>{children}</div> : children}
    </ChatProvider>
  );
}
