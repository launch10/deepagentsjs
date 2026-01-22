import { usePage } from "@inertiajs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLanggraph, type ChatSnapshot } from "langgraph-ai-sdk-react";
import { Deploy } from "@shared";
import { useChatOptions } from "@hooks/useChatOptions";

export interface DeployProps {
  thread_id: string | null;
  jwt: string;
  langgraph_path: string;
  root_path: string;
  deploy: {
    id: number;
    status: string;
    current_step: string | null;
    langgraph_thread_id: string | null;
  };
  website: { id: number } | null;
  campaign: { id: number } | null;
  [key: string]: unknown;
}

export type DeploySnapshot = ChatSnapshot<Deploy.DeployGraphState>;

function useDeployChatOptions() {
  const { deploy } = usePage<DeployProps>().props;

  return useChatOptions<Deploy.DeployBridgeType>({
    apiPath: "api/deploy/stream",
    merge: Deploy.MergeReducer as any,
    getInitialThreadId: () => deploy.langgraph_thread_id ?? undefined,
    includeAttachments: false,
  });
}

export function useDeployChat<TSelected = DeploySnapshot>(
  selector?: (snapshot: DeploySnapshot) => TSelected
): TSelected {
  const options = useDeployChatOptions();
  const snapshot = useLanggraph<Deploy.DeployBridgeType>(options);

  return (selector ? selector(snapshot) : snapshot) as TSelected;
}

// Helper hooks for common selectors
export function useDeployChatState<K extends keyof Deploy.DeployGraphState>(key: K) {
  return useDeployChat((s) => s.state[key]);
}

export function useDeployChatFullState() {
  return useDeployChat((s) => s.state);
}

export function useDeployChatStatus() {
  return useDeployChat((s) => s.status);
}

export function useDeployChatIsLoading() {
  return useDeployChat((s) => s.isLoading);
}

export function useDeployChatActions() {
  return useDeployChat((s) => s.actions);
}

export function useDeployChatThreadId() {
  return useDeployChat((s) => s.threadId);
}

/**
 * Hook that provides deploy-specific functionality including polling.
 * Uses updateState() to poll for status updates during active deploys.
 */
export function useDeployChatWithPolling() {
  const { deploy, website, campaign } = usePage<DeployProps>().props;
  const snapshot = useDeployChat();
  const { updateState, state, isLoading, error, status } = snapshot;

  const [isPolling, setIsPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start the deploy process
  const startDeploy = useCallback(() => {
    updateState({
      deploy: {
        deployId: deploy.id,
        websiteId: website?.id,
        campaignId: campaign?.id,
        website: !!website?.id,
        googleAds: !!campaign?.id,
      },
    });
  }, [updateState, deploy.id, website?.id, campaign?.id]);

  // Check if deploy is in terminal state
  const isTerminal = state.status === "completed" || state.status === "failed";
  const isInProgress = state.status === "pending" || state.status === "running";
  const isStreaming = status === "streaming" || status === "submitted";

  // Polling effect - starts when in progress and not streaming, stops when terminal
  useEffect(() => {
    const shouldPoll = isInProgress && !isStreaming;

    if (shouldPoll && !pollRef.current) {
      setIsPolling(true);
      pollRef.current = setInterval(() => {
        updateState({ polling: true });
      }, 3000);
    }

    if ((isTerminal || !shouldPoll) && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      setIsPolling(false);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [updateState, isInProgress, isStreaming, isTerminal]);

  return {
    ...snapshot,
    state,
    isLoading,
    isPolling,
    error: error ?? null,
    startDeploy,
  };
}
