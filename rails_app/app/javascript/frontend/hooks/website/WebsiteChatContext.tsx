import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { usePage } from "@inertiajs/react";
import type { InertiaProps } from "@shared";

type WebsitePageProps =
  InertiaProps.paths["/projects/{uuid}/website"]["get"]["responses"]["200"]["content"]["application/json"];

type WebsiteChatContextValue = {
  /** The resolved threadId - either from server props or from onThreadIdAvailable */
  threadId: string | undefined;
  /** Callback to pass to useLanggraph's onThreadIdAvailable */
  onThreadIdAvailable: (threadId: string) => void;
};

const WebsiteChatContext = createContext<WebsiteChatContextValue | null>(null);

/**
 * Provider that shares the chat threadId across all website chat hooks.
 *
 * When a new chat is created, the threadId isn't known until after the first
 * interaction with langgraph. This provider captures that threadId via
 * onThreadIdAvailable and makes it available to all child components,
 * so late-mounting components (like WebsitePreview) can find the correct chat.
 */
export function WebsiteChatProvider({ children }: { children: ReactNode }) {
  const { thread_id: serverThreadId } = usePage<WebsitePageProps>().props;

  // State to hold threadId received from langgraph (for new chats)
  const [receivedThreadId, setReceivedThreadId] = useState<string | undefined>(undefined);

  const onThreadIdAvailable = useCallback((threadId: string) => {
    setReceivedThreadId(threadId);
  }, []);

  // Prefer server threadId (returning to existing chat), fall back to received
  const threadId = serverThreadId || receivedThreadId;

  const value = useMemo(
    () => ({ threadId, onThreadIdAvailable }),
    [threadId, onThreadIdAvailable]
  );

  return <WebsiteChatContext.Provider value={value}>{children}</WebsiteChatContext.Provider>;
}

export function useWebsiteChatContext() {
  const context = useContext(WebsiteChatContext);
  if (!context) {
    throw new Error("useWebsiteChatContext must be used within WebsiteChatProvider");
  }
  return context;
}
