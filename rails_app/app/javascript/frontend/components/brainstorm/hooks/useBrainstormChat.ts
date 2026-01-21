import { usePage, router } from "@inertiajs/react";
import { useMemo, useCallback, useRef } from "react";
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
 * Check if URL already contains this threadId (prevents duplicate navigation)
 */
function isAlreadyAtThreadUrl(threadId: string): boolean {
  const match = window.location.pathname.match(/^\/projects\/([^/]+)\/brainstorm$/);
  return match?.[1] === threadId;
}

const urlThreadId = () => {
  const match = window.location.pathname.match(/^\/projects\/([^/]+)\/brainstorm$/);
  return match?.[1]
}

function useBrainstormChatOptions() {
  // const page = usePage<BrainstormPageProps>();
  // const { thread_id, jwt, langgraph_path, root_path } = page.props;
  const jwt = `eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI1NTc3MWVkYy04ZjAxLTQ1MzUtYTdiNy1jMDc2ZDZhNWI3MDQiLCJzdWIiOjEsImFjY291bnRfaWQiOjEsImV4cCI6MTc2OTA4OTEzOSwiaWF0IjoxNzY5MDAyNzM5fQ.FWkdGXTf9L7fpA_zsbqbeZbM-AeovoXcjS1DwPeZch0`;
  const thread_id = urlThreadId();
  const langgraph_path = `http://localhost:4000`;
  const root_path = `http://localhost:3000`;

  // Use ref to capture current page state for router.push without causing re-renders
  // const pageRef = useRef(page);
  // pageRef.current = page;

  const onThreadIdAvailable = useCallback((threadId: string) => {
    // Defensive check - prevent navigation with undefined threadId
    if (!threadId || threadId === "undefined" || threadId === "null") {
      console.error("[useBrainstormChat] onThreadIdAvailable called with invalid threadId:", threadId, new Error().stack);
      return;
    }

    // Guard: don't navigate if URL already has this threadId
    if (isAlreadyAtThreadUrl(threadId)) {
      return;
    }

    // Use Inertia's router.push for client-side URL update without server request.
    // This properly integrates with Inertia's history tracking, so back/forward
    // navigation works correctly.
    const newUrl = `/projects/${threadId}/brainstorm`;
    router.push({
      url: newUrl,
      component: "Brainstorm",
      props: { thread_id: threadId },
    });
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
      getInitialThreadId: () => (thread_id ? thread_id : undefined),
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
