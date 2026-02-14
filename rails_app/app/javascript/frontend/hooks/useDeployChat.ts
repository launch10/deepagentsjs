import { usePage } from "@inertiajs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanggraph, type ChatSnapshot, type LanggraphChat } from "langgraph-ai-sdk-react";
import type { UIMessage } from "ai";
import { Deploy } from "@shared";
import { useChatOptions } from "@hooks/useChatOptions";

export interface WebsiteDeployRecord {
  id: number;
  status: string;
  environment: string;
  is_live: boolean;
  revertible: boolean;
  created_at: string;
}

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
  } | null;
  deploy_type: "website" | "campaign";
  website: { id: number } | null;
  website_url: string | null;
  deploy_environment: string;
  campaign: { id: number } | null;
  project: { id: number; uuid: string };
  [key: string]: unknown;
}

export type DeploySnapshot = ChatSnapshot<Deploy.DeployGraphState>;

function useDeployChatOptions() {
  const { deploy } = usePage<DeployProps>().props;

  return useChatOptions<Deploy.DeployBridgeType>({
    apiPath: "api/deploy/stream",
    merge: Deploy.MergeReducer as any,
    getInitialThreadId: () => deploy?.langgraph_thread_id ?? undefined,
    includeAttachments: false,
  });
}

/**
 * Get the deploy chat instance for use with Chat.Root.
 * Returns a stable chat instance that can be passed to Chat.Root.
 *
 * @example
 * ```tsx
 * function DeployPage() {
 *   const chat = useDeployChatInstance();
 *   return (
 *     <Chat.Root chat={chat}>
 *       <DeployContent />
 *     </Chat.Root>
 *   );
 * }
 * ```
 */
export function useDeployChatInstance(): LanggraphChat<UIMessage, Deploy.DeployGraphState> {
  const options = useDeployChatOptions();
  return useLanggraph(options, (s) => s.chat);
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
const STUCK_THRESHOLD_MS = 180_000; // 3 minutes without task state change

export function useDeployChatWithPolling() {
  const props = usePage<DeployProps>().props;
  const { deploy_type, website, campaign } = props;
  // Read projectId directly from page props (always synchronous) rather than
  // from the project store, which may not be hydrated yet when startDeploy fires.
  const projectId = (props.project as { id?: number } | null)?.id;
  const snapshot = useDeployChat();
  const { updateState, state, isLoading, error, status } = snapshot;

  const [isPolling, setIsPolling] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTaskSnapshotRef = useRef<string>("");
  const lastChangeTimeRef = useRef<number>(Date.now());

  // Start the deploy process — graph's initDeployNode creates the Deploy record.
  // We only send project/website/campaign IDs and deploy instructions.
  const startDeploy = useCallback(() => {
    const isCampaign = deploy_type === "campaign";
    updateState({
      projectId,
      websiteId: website?.id,
      campaignId: isCampaign ? campaign?.id : undefined,
      deploy: {
        website: !!website?.id,
        googleAds: isCampaign,
      },
    });
  }, [updateState, deploy_type, website?.id, campaign?.id, projectId]);

  // The graph sets status: "running" on entry, "completed"/"failed" at exit.
  const isTerminal = state.status === "completed" || state.status === "failed";
  const isInProgress = state.status === "running";
  const isStreaming = status === "streaming" || status === "submitted";

  // Stuck detection: track task state changes
  useEffect(() => {
    if (!isInProgress || isTerminal) {
      setIsStuck(false);
      return;
    }

    // Create a snapshot of task statuses to detect changes
    const taskSnapshot = JSON.stringify(
      state.tasks?.map((t) => ({ n: t.name, s: t.status })) ?? []
    );

    if (taskSnapshot !== lastTaskSnapshotRef.current) {
      lastTaskSnapshotRef.current = taskSnapshot;
      lastChangeTimeRef.current = Date.now();
      setIsStuck(false);
    } else {
      const elapsed = Date.now() - lastChangeTimeRef.current;
      setIsStuck(elapsed > STUCK_THRESHOLD_MS);
    }
  }, [state.tasks, state.status, isInProgress, isTerminal]);

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
    isStuck,
    error: error ?? null,
    startDeploy,
  };
}
