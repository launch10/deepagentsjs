import { usePage, router } from "@inertiajs/react";
import { useMemo, useCallback, useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import {
  type ChatSnapshot,
  type LanggraphChat,
  type UseLanggraphOptions,
  useLanggraph,
} from "langgraph-ai-sdk-react";
import type { BrainstormGraphState, InertiaProps, BrainstormBridgeType } from "@shared";
import { UploadsAPIService } from "@rails_api_base";
import { validateFile } from "~/types/attachment";
import { syncLanggraphToStore } from "~/stores/useSyncProject";
import { useJwt, useLanggraphPath, useRootPath } from "~/stores/sessionStore";

type NewBrainstormProps =
  InertiaProps.paths["/projects/new"]["get"]["responses"]["200"]["content"]["application/json"];
type UpdateBrainstormProps =
  InertiaProps.paths["/projects/{uuid}/brainstorm"]["get"]["responses"]["200"]["content"]["application/json"];
type BrainstormPageProps = NewBrainstormProps | UpdateBrainstormProps;

export type BrainstormSnapshot = ChatSnapshot<BrainstormGraphState>;

/**
 * Check if URL already contains this threadId (prevents duplicate navigation)
 */
function isAlreadyAtThreadUrl(threadId: string): boolean {
  const urlThreadId = getThreadIdFromUrl();
  return urlThreadId === threadId;
}

function getThreadIdFromUrl(): string | undefined {
  const match = window.location.pathname.match(/^\/projects\/([^/]+)\/brainstorm$/);
  return match?.[1];
}

/**
 * Get the chat options for the brainstorm chat.
 * This is a hook that creates stable options based on page props.
 */
function useBrainstormChatOptions(): UseLanggraphOptions<BrainstormBridgeType> {
  const page = usePage<BrainstormPageProps>();
  const { thread_id, project } = page.props;
  // Session-level values: prefer store (refreshed by useJwtRefresh),
  // fall back to page props on first render before store hydration
  const storeJwt = useJwt();
  const storeLanggraphPath = useLanggraphPath();
  const storeRootPath = useRootPath();
  const jwt = storeJwt ?? (page.props as any).jwt;
  const langgraph_path = storeLanggraphPath ?? (page.props as any).langgraph_path;
  const root_path = storeRootPath ?? (page.props as any).root_path;

  const onThreadIdAvailable = useCallback(
    (threadId: string) => {
      // Defensive check - prevent navigation with undefined threadId
      if (!threadId || threadId === "undefined" || threadId === "null") {
        console.error(
          "[useBrainstormChat] onThreadIdAvailable called with invalid threadId:",
          threadId,
          new Error().stack
        );
        return;
      }

      // Guard: don't navigate if URL already has this threadId
      if (isAlreadyAtThreadUrl(threadId)) {
        return;
      }

      // Use Inertia's router.push for client-side URL update without server request.
      const newUrl = `/projects/${threadId}/brainstorm`;
      router.push({
        url: newUrl,
        component: "Brainstorm",
        props: {
          thread_id: threadId,
          jwt,
          langgraph_path,
          root_path,
          project: {
            ...project,
            uuid: threadId,
          },
        },
      });
    },
    [jwt, langgraph_path, root_path, project]
  );

  return useMemo(() => {
    const url = langgraph_path ? new URL("api/brainstorm/stream", langgraph_path).toString() : "";
    const uploadService = new UploadsAPIService({ jwt: jwt ?? "", baseUrl: root_path ?? "" });

    return {
      api: url,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      // Check URL first (for after history.pushState), then fall back to Inertia props
      getInitialThreadId: () => getThreadIdFromUrl() ?? (thread_id ? thread_id : undefined),
      onThreadIdAvailable,
      // Composer attachments config - uploads return URLs and original filename
      attachments: {
        upload: async (file: File) => {
          const response = await uploadService.create({
            file,
            isLogo: false,
          });
          return {
            url: response.url,
            meta: { filename: response.filename },
          };
        },
        validate: validateFile,
      },
    };
  }, [thread_id, jwt, langgraph_path, onThreadIdAvailable, root_path]);
}

/**
 * Get or create the brainstorm chat instance.
 * Returns a stable chat instance that can be passed to Chat.Root.
 *
 * This is the REGISTRATION function - it creates/retrieves the chat instance
 * based on the current page props. The identity is `${api}::${threadId}`.
 *
 * @example
 * ```tsx
 * function BrainstormPage() {
 *   const chat = useBrainstormChat();
 *
 *   return (
 *     <Chat.Root chat={chat}>
 *       <BrainstormContent />
 *     </Chat.Root>
 *   );
 * }
 * ```
 */
export function useBrainstormChat(): LanggraphChat<UIMessage, BrainstormGraphState> {
  const options = useBrainstormChatOptions();
  const chat = useLanggraph(options, (s) => s.chat);
  syncBrainstormToStore();
  useBrainstormEmptyHistoryRecovery();

  return chat;
}

const BRAINSTORM_GREETING =
  "Let's brainstorm your next big idea. Tell me about the business or product you're working on — what problem does it solve, and who is it for?";

/**
 * Self-recovery hook: when history finishes loading but yields zero messages
 * (e.g. thread exists but has no checkpoints), inject a default AI greeting
 * so downstream components render normally.
 */
function useBrainstormEmptyHistoryRecovery() {
  const isLoadingHistory = useBrainstormSelector((s) => s.isLoadingHistory);
  const messageCount = useBrainstormSelector((s) => s.messages.length);
  const threadId = useBrainstormSelector((s) => s.threadId);
  const setMessages = useBrainstormSelector((s) => s.setMessages);
  const recoveredRef = useRef(false);

  useEffect(() => {
    if (!isLoadingHistory && messageCount === 0 && threadId && !recoveredRef.current) {
      recoveredRef.current = true;
      setMessages([
        {
          id: "brainstorm-greeting",
          role: "assistant" as const,
          parts: [
            {
              type: "data-content-block-text",
              id: "brainstorm-greeting-text",
              data: { text: BRAINSTORM_GREETING, index: 0 },
            },
          ],
        } as any,
      ]);
    }
  }, [isLoadingHistory, messageCount, threadId, setMessages]);
}

export const useBrainstormSelector = <TSelected>(
  selector: (snapshot: BrainstormSnapshot) => TSelected
) => {
  const options = useBrainstormChatOptions();
  return useLanggraph(options, selector);
};

export function useBrainstormMessages() {
  return useBrainstormSelector((s) => s.messages);
}

export function useBrainstormStatus() {
  return useBrainstormSelector((s) => s.status);
}

export function useBrainstormIsLoading() {
  return useBrainstormSelector((s) => s.isLoading);
}

export function useBrainstormIsLoadingHistory(
  chat: LanggraphChat<UIMessage, BrainstormGraphState>
) {
  return useBrainstormSelector((s) => s.isLoadingHistory);
}

export function useBrainstormComposer() {
  return useBrainstormSelector((s) => s.composer);
}

export function useBrainstormActions() {
  return useBrainstormSelector((s) => s.actions);
}

export function useBrainstormThreadId() {
  return useBrainstormSelector((s) => s.threadId);
}

export function useBrainstormWebsiteId() {
  return useBrainstormSelector((s) => s.state.websiteId);
}

/**
 * Returns whether this is a new conversation (should show landing page).
 * Uses page props thread_id as the primary check, falls back to SDK messages.
 */
export function useBrainstormIsNewConversation() {
  const { thread_id } = usePage<BrainstormPageProps>().props;
  // Call hooks unconditionally to follow Rules of Hooks
  const hasNoMessages = useBrainstormSelector((s) => s.messages.length === 0);

  // If page props has thread_id, it's not a new conversation
  if (thread_id) return false;
  return hasNoMessages;
}

/**
 * Returns whether the chat is currently streaming a response.
 */
export function useBrainstormIsStreaming() {
  const status = useBrainstormSelector((s) => s.status);
  return status === "streaming" || status === "submitted";
}

/**
 * Syncs entity IDs from Langgraph state to the core entity store.
 * Call this once in the page component that uses the brainstorm chat.
 */
export function syncBrainstormToStore() {
  const websiteId = useBrainstormSelector((s) => s.state.websiteId);
  const projectId = useBrainstormSelector((s) => s.state.projectId);

  syncLanggraphToStore("websiteId", websiteId);
  syncLanggraphToStore("projectId", projectId);
}
