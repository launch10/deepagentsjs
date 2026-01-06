import { usePage } from "@inertiajs/react";
import { useMemo, useCallback } from "react";
import { useLanggraph, type ChatSnapshot } from "langgraph-ai-sdk-react";
import type { BrainstormBridgeType, BrainstormGraphState, InertiaProps } from "@shared";
import { UploadsAPIService } from "@rails_api_base";
import { validateFile } from "types/attachment";

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
    // We use native pushState instead of Inertia's router.replace for several reasons:
    //
    // 1. Stream continuity: When the user sends their first message, the backend starts
    //    streaming a response. Inertia's router.replace triggers page lifecycle callbacks
    //    (onSuccess, onFinish) and updates Inertia's internal page state, which can cause
    //    React re-renders that interrupt the active stream connection.
    //
    // 2. No server request needed: Inertia v2's router.replace({ url }) is client-side only,
    //    but it still updates Inertia's page object and triggers lifecycle hooks. We only
    //    need to update the browser URL without any side effects.
    //
    // 3. Integration with WorkflowProvider: The app's WorkflowProvider already patches
    //    history.pushState to dispatch custom 'urlchange' events, ensuring the workflow
    //    store stays in sync. Using native pushState integrates with this existing pattern.
    //
    // 4. Back button consistency: pushState adds a history entry, allowing users to
    //    navigate back to /projects/new. This is intentional - starting a new brainstorm
    //    creates a recoverable navigation point.
    //
    // Investigated as part of TODO-003. See: v2 Inertia docs on router.push/replace.
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
