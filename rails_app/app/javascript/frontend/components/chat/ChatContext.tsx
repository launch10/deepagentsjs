import { createContext, useContext, type ReactNode } from "react";
import type { ChatSnapshot, ChatActions } from "langgraph-ai-sdk-react";
import type { Composer, AnyMessageWithBlocks } from "langgraph-ai-sdk-types";

/**
 * Chat context value - wraps a ChatSnapshot and provides convenience accessors.
 * The chat instance IS the state - we don't duplicate, just expose.
 */
export interface ChatContextValue<TState extends Record<string, unknown> = Record<string, unknown>> {
  // The raw chat snapshot
  snapshot: ChatSnapshot<TState>;

  // Convenience accessors (subcomponents use these)
  messages: AnyMessageWithBlocks[];
  composer: Composer;
  status: ChatSnapshot<TState>["status"];
  isStreaming: boolean;
  isLoading: boolean;

  // Actions
  /** Raw sendMessage from snapshot - use `submit` for UI components */
  sendMessage: ChatSnapshot<TState>["sendMessage"];
  /** Submit action for UI components - uses custom onSubmit if provided, else sendMessage */
  submit: () => void;
  stop: ChatSnapshot<TState>["stop"];
}

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Main hook to access the full chat context.
 * Throws if used outside Chat.Root.
 */
export function useChatContext<TState extends Record<string, unknown> = Record<string, unknown>>(): ChatContextValue<TState> {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext must be used within Chat.Root");
  }
  return ctx as ChatContextValue<TState>;
}

// Provider component props
export interface ChatProviderProps<TState extends Record<string, unknown>> {
  snapshot: ChatSnapshot<TState>;
  children: ReactNode;
  /**
   * Optional custom submit handler. When provided, all Chat.Input components
   * will use this instead of the snapshot's sendMessage for submit actions.
   * Useful for wrapping sendMessage with additional behavior (e.g., workflow sync).
   */
  onSubmit?: ChatActions<TState>["sendMessage"];
}

/**
 * Internal provider component - used by Chat.Root.
 */
export function ChatProvider<TState extends Record<string, unknown>>({
  snapshot,
  children,
  onSubmit,
}: ChatProviderProps<TState>) {
  // Cast messages to AnyMessageWithBlocks[] - the types are compatible at runtime
  // but TypeScript has trouble with the StructuredMessageBlock generic
  const messages = snapshot.messages as unknown as AnyMessageWithBlocks[];

  // Submit uses custom handler if provided, otherwise raw sendMessage
  const submit = onSubmit ?? (() => snapshot.sendMessage());

  const value: ChatContextValue<TState> = {
    snapshot,
    messages,
    composer: snapshot.composer,
    status: snapshot.status,
    isStreaming: snapshot.status === "streaming" || snapshot.status === "submitted",
    isLoading: snapshot.isLoading,
    sendMessage: snapshot.sendMessage,
    submit,
    stop: snapshot.stop,
  };

  return (
    <ChatContext.Provider value={value as ChatContextValue}>
      {children}
    </ChatContext.Provider>
  );
}

// Re-export the context for testing purposes
export { ChatContext };
