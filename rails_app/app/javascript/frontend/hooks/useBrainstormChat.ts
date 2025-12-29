import { usePage } from "@inertiajs/react";
import { useMemo } from "react";
import { useLanggraph, type ChatSnapshot } from "langgraph-ai-sdk-react";
import type { BrainstormBridgeType, BrainstormGraphState, InertiaProps } from "@shared";

type NewBrainstormProps =
  InertiaProps.paths["/projects/new"]["get"]["responses"]["200"]["content"]["application/json"];
type UpdateBrainstormProps =
  InertiaProps.paths["/projects/{uuid}/brainstorm"]["get"]["responses"]["200"]["content"]["application/json"];
type BrainstormPageProps = NewBrainstormProps | UpdateBrainstormProps;

export type BrainstormSnapshot = ChatSnapshot<BrainstormGraphState>;

function useBrainstormChatOptions() {
  const { thread_id, jwt, langgraph_path } = usePage<BrainstormPageProps>().props;

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
      getInitialThreadId: () => (thread_id ? thread_id : undefined),
    };
  }, [thread_id, jwt, langgraph_path]);
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

export function useBrainstormChatActions() {
  return useBrainstormChat((s) => s.actions);
}

export function useBrainstormChatThreadId() {
  return useBrainstormChat((s) => s.threadId);
}

/**
 * Returns whether this is a new conversation (no initial thread ID from server).
 */
export function useBrainstormIsNewConversation() {
  const { thread_id } = usePage<BrainstormPageProps>().props;
  return !thread_id;
}
