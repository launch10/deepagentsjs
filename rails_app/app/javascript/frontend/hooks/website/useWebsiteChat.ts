import { useLanggraph, type ChatSnapshot, type LanggraphChat } from "langgraph-ai-sdk-react";
import type { UIMessage } from "ai";
import type { WebsiteBridgeType, WebsiteGraphState } from "@shared";
import { syncLanggraphToStore } from "~/stores/useSyncProject";
import { useChatOptions } from "@hooks/useChatOptions";
import { useCallback, useEffect, useRef } from "react";
import { usePage, router } from "@inertiajs/react";

interface WebsitePageProps {
  website?: { id?: number };
  project?: { id?: number; uuid?: string };
  thread_id?: string;
  jwt?: string;
  langgraph_path?: string;
  root_path?: string;
  [key: string]: unknown;
}

export type WebsiteSnapshot = ChatSnapshot<WebsiteGraphState>;

function useWebsiteChatOptions() {
  const page = usePage<WebsitePageProps>();
  const { project, jwt, langgraph_path, root_path } = page.props;

  const onThreadIdAvailable = useCallback(
    (threadId: string) => {
      if (!threadId || threadId === "undefined" || threadId === "null") {
        console.error(
          "[useWebsiteChat] onThreadIdAvailable called with invalid threadId:",
          threadId
        );
        return;
      }

      // Update Inertia page props with the new thread_id (URL stays the same)
      router.push({
        url: window.location.pathname,
        component: "Website",
        props: {
          ...page.props,
          thread_id: threadId,
        },
      });
    },
    [page.props]
  );

  return useChatOptions<WebsiteBridgeType>({
    apiPath: "api/website/stream",
    onThreadIdAvailable,
  });
}

/**
 * Seed websiteId and projectId from page props into the chat's client-side
 * state so they're always present when sendMessage fires — including
 * follow-up edits on existing threads.
 */
function useSeedPageProps(chat: LanggraphChat<UIMessage, WebsiteGraphState>) {
  const { website, project } = usePage<WebsitePageProps>().props;
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    const websiteId = website?.id;
    const projectId = project?.id;
    if (!websiteId || !projectId) return;

    seeded.current = true;
    chat.setState({ websiteId, projectId } as Partial<WebsiteGraphState>);
  }, [chat, website?.id, project?.id]);
}

export function useWebsiteChat(): LanggraphChat<UIMessage, WebsiteGraphState> {
  const options = useWebsiteChatOptions();
  const chat = useLanggraph(options, (s) => s.chat);
  useSeedPageProps(chat);
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
