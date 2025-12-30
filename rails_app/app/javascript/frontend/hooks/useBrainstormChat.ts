import { usePage } from "@inertiajs/react";
import { useMemo, useCallback } from "react";
import { useLanggraph, type ChatSnapshot } from "langgraph-ai-sdk-react";
import type { BrainstormBridgeType, BrainstormGraphState, InertiaProps } from "@shared";

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
  const { thread_id, jwt, langgraph_path } = usePage<BrainstormPageProps>().props;

  const onThreadIdAvailable = useCallback((threadId: string) => {
    // Update URL without full navigation so new components can read the threadId
    const newUrl = `/projects/${threadId}/brainstorm`;
    window.history.pushState({ threadId }, "", newUrl);
  }, []);

  return useMemo(() => {
    const url = langgraph_path
      ? new URL("api/brainstorm/stream", langgraph_path).toString()
      : "";
    return {
      api: url,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      // Check URL first (for after history.pushState), then fall back to Inertia props
      getInitialThreadId: () => getThreadIdFromUrl() ?? (thread_id ? thread_id : undefined),
      onThreadIdAvailable,
    };
  }, [thread_id, jwt, langgraph_path, onThreadIdAvailable]);
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
 * Returns chat actions with sendMessage guarded against empty messages.
 * Empty messages (whitespace-only) are blocked unless additional state is provided
 * (e.g., uploadIds for file attachments). This prevents the Langgraph backend
 * from becoming unresponsive when receiving empty message payloads.
 */
export function useBrainstormChatActions() {
  return useBrainstormChat((s) => {
    const { sendMessage, ...rest } = s.actions;

    const guardedSendMessage: typeof sendMessage = (message, additionalState) => {
      const hasMessage = message.trim().length > 0;
      const hasAdditionalState = additionalState && Object.keys(additionalState).length > 0;

      if (!hasMessage && !hasAdditionalState) {
        console.warn("[useBrainstormChatActions] Blocked empty message submission");
        return;
      }

      sendMessage(message, additionalState);
    };

    return { sendMessage: guardedSendMessage, ...rest };
  });
}

export function useBrainstormChatThreadId() {
  return useBrainstormChat((s) => s.threadId);
}

/**
 * Returns whether this is a new conversation (should show landing page).
 * Uses messages.length === 0 as the source of truth for routing.
 * This allows the UI to switch from Landing to Conversation when the first message is sent,
 * without needing an Inertia navigation.
 */
export function useBrainstormIsNewConversation() {
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
