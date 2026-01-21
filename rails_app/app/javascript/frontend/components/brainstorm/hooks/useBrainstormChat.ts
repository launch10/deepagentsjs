import { usePage } from "@inertiajs/react";
import { useMemo, useCallback } from "react";
import { useLanggraph, type ChatSnapshot } from "langgraph-ai-sdk-react";
import type { BrainstormBridgeType, BrainstormGraphState, InertiaProps } from "@shared";
import { UploadsAPIService } from "@rails_api_base";
import { validateFile } from "~/types/attachment";
import { syncLanggraphToStore } from "~/stores/useSyncCoreEntities";

type NewBrainstormProps =
  InertiaProps.paths["/projects/new"]["get"]["responses"]["200"]["content"]["application/json"];
type UpdateBrainstormProps =
  InertiaProps.paths["/projects/{uuid}/brainstorm"]["get"]["responses"]["200"]["content"]["application/json"];
type BrainstormPageProps = NewBrainstormProps | UpdateBrainstormProps;

export type BrainstormSnapshot = ChatSnapshot<BrainstormGraphState>;

/**
 * Extract threadId from URL path like /projects/{uuid}/brainstorm
 */
function getThreadIdFromUrl(): string | undefined {
  const match = window.location.pathname.match(/^\/projects\/([^/]+)\/brainstorm$/);
  return match?.[1];
}

function useBrainstormChatOptions() {
  const { thread_id, jwt, langgraph_path, root_path } = usePage<BrainstormPageProps>().props;

  const onThreadIdAvailable = useCallback((threadId: string) => {
    // Defensive check - prevent navigation with undefined threadId
    if (!threadId || threadId === "undefined" || threadId === "null") {
      console.error("[useBrainstormChat] onThreadIdAvailable called with invalid threadId:", threadId, new Error().stack);
      return;
    }

    // We use native pushState to update the URL without making a server request.
    //
    // Why pushState instead of router.visit:
    // 1. Stream continuity: When the user sends their first message, the backend starts
    //    streaming a response. Even router.visit with only: [] makes a server request,
    //    which would fail because the project doesn't exist in Rails yet (it's being
    //    created by Langgraph).
    // 2. The project is created asynchronously by Langgraph, so we need to update the
    //    URL immediately without waiting for Rails to know about it.
    //
    // Back/forward navigation handling:
    // When users press back then forward, Inertia won't have cached state for this URL.
    // This is handled by the popstate listener in WorkflowProvider, which detects URLs
    // that need fresh data and triggers an Inertia reload. The reload happens AFTER
    // we've returned to the URL, so the project will exist by then.
    //
    // We include the current Inertia page state in history.state so Inertia can
    // partially restore the page while the reload happens.
    //
    // Investigated as part of TODO-003. See: https://github.com/inertiajs/inertia/discussions/1809
    const newUrl = `/projects/${threadId}/brainstorm`;
    window.history.pushState({ threadId }, "", newUrl);
  }, []);

  return useMemo(() => {
    const url = langgraph_path ? new URL("api/brainstorm/stream", langgraph_path).toString() : "";
    const uploadService = new UploadsAPIService({ jwt, baseUrl: root_path });

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

export function useBrainstormChat<TSelected = BrainstormSnapshot>(
  selector?: (snapshot: BrainstormSnapshot) => TSelected
): TSelected {
  const options = useBrainstormChatOptions();
  const snapshot = useLanggraph<BrainstormBridgeType>(options);

  return (selector ? selector(snapshot) : snapshot) as TSelected;
}

export function useBrainstormChatMessages() {
  return useBrainstormChat((s) => s.messages);
}

export function useBrainstormChatState<K extends keyof BrainstormGraphState>(key: K) {
  return useBrainstormChat((s) => s.state[key]);
}

export function useBrainstormChatFullState() {
  return useBrainstormChat((s) => s.state);
}

export function useBrainstormChatStatus() {
  return useBrainstormChat((s) => s.status);
}

export function useBrainstormChatIsLoading() {
  return useBrainstormChat((s) => s.isLoading);
}

export function useBrainstormChatIsLoadingHistory() {
  return useBrainstormChat((s) => s.isLoadingHistory);
}

/**
 * Returns the composer for managing message input and attachments.
 * Use composer.text, composer.setText, composer.addFiles, etc.
 */
export function useBrainstormChatComposer() {
  return useBrainstormChat((s) => s.composer);
}

/**
 * Returns chat actions from the snapshot.
 */
export function useBrainstormChatActions() {
  return useBrainstormChat((s) => s.actions);
}

export function useBrainstormChatThreadId() {
  return useBrainstormChat((s) => s.threadId);
}

export function useBrainstormChatWebsiteId() {
  return useBrainstormChat((s) => s.state.websiteId);
}

/**
 * Returns whether this is a new conversation (should show landing page).
 * Uses messages.length === 0 as the source of truth for routing.
 * This allows the UI to switch from Landing to Conversation when the first message is sent,
 * without needing an Inertia navigation.
 */
export function useBrainstormIsNewConversation() {
  const { thread_id } = usePage<BrainstormPageProps>().props;
  if (thread_id) return false;

  return useBrainstormChat((s) => s.messages.length === 0);
}

/**
 * Returns whether the chat is currently streaming a response.
 * Uses message-based detection: streaming when there's only one human message
 * (waiting for the AI response).
 */
export function useBrainstormChatIsStreaming() {
  return useBrainstormChat((s) => {
    const { status } = s;
    return status === "streaming" || status === "submitted";
  });
}

/**
 * Syncs entity IDs from Langgraph state to the core entity store.
 * Call this once in the page component that uses the brainstorm chat.
 *
 * This subscribes to individual state keys (not full state) for efficiency.
 */
export function useSyncBrainstormEntities() {
  const websiteId = useBrainstormChatState("websiteId");
  const projectId = useBrainstormChatState("projectId");

  syncLanggraphToStore("websiteId", websiteId);
  syncLanggraphToStore("projectId", projectId);
}
