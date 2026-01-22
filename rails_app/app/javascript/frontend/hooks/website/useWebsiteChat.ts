import { useLanggraph, type ChatSnapshot, type LanggraphChat } from "langgraph-ai-sdk-react";
import type { UIMessage } from "ai";
import type { WebsiteBridgeType, WebsiteGraphState } from "@shared";
import { syncLanggraphToStore } from "~/stores/useSyncProject";
import { useChatOptions } from "@hooks/useChatOptions";

export type WebsiteSnapshot = ChatSnapshot<WebsiteGraphState>;

function useWebsiteChatOptions() {
  return useChatOptions<WebsiteBridgeType>({ apiPath: "api/website/stream" });
}

export function useWebsiteChat(): LanggraphChat<UIMessage, WebsiteGraphState> {
  const options = useWebsiteChatOptions();
  const chat = useLanggraph(options, (s) => s.chat);
  syncWebsiteToStore();

  return chat;
}

export const useWebsiteSelector = <TSelected>(
  selector: (snapshot: WebsiteSnapshot) => TSelected
) => {
  const options = useWebsiteChatOptions();
  return useLanggraph(options, selector);
};

export function useWebsiteChatMessages() {
  return useWebsiteSelector((s) => s.messages);
}

export function useWebsiteChatState<K extends keyof WebsiteGraphState>(key: K) {
  return useWebsiteSelector((s) => s.state[key]);
}

export function useWebsiteChatFullState() {
  return useWebsiteSelector((s) => s.state);
}

export function useWebsiteChatStatus() {
  return useWebsiteSelector((s) => s.status);
}

export function useWebsiteChatIsLoading() {
  return useWebsiteSelector((s) => s.isLoading);
}

export function useWebsiteChatIsLoadingHistory() {
  return useWebsiteSelector((s) => s.isLoadingHistory);
}

export function useWebsiteChatActions() {
  return useWebsiteSelector((s) => s.actions);
}

export function useWebsiteChatThreadId() {
  return useWebsiteSelector((s) => s.threadId);
}

/**
 * Returns the composer for managing message input.
 * Use composer.text, composer.setText, etc.
 */
export function useWebsiteChatComposer() {
  return useWebsiteSelector((s) => s.composer);
}

/**
 * Returns whether the chat is currently streaming a response.
 */
export function useWebsiteChatIsStreaming() {
  return useWebsiteSelector((s) => {
    const { status } = s;
    return status === "streaming" || status === "submitted";
  });
}

/**
 * Syncs entity IDs from Langgraph state to the core entity store.
 * Call this once in the page component that uses the website chat.
 */
export function syncWebsiteToStore() {
  const websiteId = useWebsiteChatState("websiteId");
  const projectId = useWebsiteChatState("projectId");

  syncLanggraphToStore("websiteId", websiteId);
  syncLanggraphToStore("projectId", projectId);
}
