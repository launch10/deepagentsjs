import { useLanggraph, type ChatSnapshot, type LanggraphChat } from "langgraph-ai-sdk-react";
import type { UIMessage } from "ai";
import type { WebsiteBridgeType, WebsiteGraphState } from "@shared";
import { WebsiteMergeReducer } from "@shared";
import { syncLanggraphToStore } from "~/stores/useSyncProject";
import { useChatOptions } from "@hooks/useChatOptions";
import { useCallback, useEffect, useRef } from "react";
import { usePage, router } from "@inertiajs/react";
import { useQueryClient } from "@tanstack/react-query";
import { websiteKeys } from "@api/websites.hooks";
import { themeKeys } from "@api/themes.hooks";

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
    merge: WebsiteMergeReducer as any,
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
  useSyncThemeFromChat();

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
 * Returns whether the website is in its initial loading phase:
 * history is loading, or streaming before files are ready and todos aren't all done.
 */
export function useWebsiteChatIsInitialLoading() {
  return useWebsiteSelector((s) => {
    const isStreaming = s.status === "streaming" || s.status === "submitted";
    const files = s.state.files;
    const hasFiles = files && Object.keys(files).length > 0;
    const todos = s.state.todos;
    const allTodosCompleted =
      todos && todos.length > 0 && todos.every((t) => t.status === "completed");
    return s.isLoadingHistory || (isStreaming && !hasFiles && !allTodosCompleted);
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

/**
 * Watches themeId from Langgraph streaming state and invalidates
 * React Query caches so the theme picker stays in sync when the
 * coding agent creates a new theme via change_color_scheme tool.
 */
function useSyncThemeFromChat() {
  const themeId = useWebsiteChatState("themeId");
  const websiteId = useWebsiteChatState("websiteId");
  const queryClient = useQueryClient();
  const prevThemeIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (themeId == null) return;
    if (themeId === prevThemeIdRef.current) return;

    prevThemeIdRef.current = themeId;

    // Invalidate website query so useWebsite() refetches with new theme_id
    if (websiteId) {
      queryClient.invalidateQueries({ queryKey: websiteKeys.detail(websiteId) });
    }
    // Invalidate themes list so newly created themes appear in the picker
    queryClient.invalidateQueries({ queryKey: themeKeys.lists() });
  }, [themeId, websiteId, queryClient]);
}
