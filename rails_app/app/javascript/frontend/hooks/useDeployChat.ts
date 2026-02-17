import { usePage } from "@inertiajs/react";
import { useCallback, useMemo, useState } from "react";
import { useLanggraph, type ChatSnapshot, type LanggraphChat } from "langgraph-ai-sdk-react";
import type { UIMessage } from "ai";
import { Deploy, type InertiaProps } from "@shared";
import { useChatOptions } from "@hooks/useChatOptions";
import { useDeployInstructions } from "@hooks/useDeployInstructions";
import { useProjectId } from "~/stores/projectStore";
import { useDeployService } from "@api/deploys.hooks";

export type DeployProps =
  InertiaProps.paths["/projects/{uuid}/deploy"]["get"]["responses"]["200"]["content"]["application/json"];

export type DeploySnapshot = ChatSnapshot<Deploy.DeployGraphState>;

/**
 * Module-level cache of the resolved deploy threadId.
 *
 * When `thread_id` is null in page props (no active deploy chat on page load),
 * the SDK generates a random threadId and rekeys the registry entry from
 * `api::__new__` to `api::<threadId>`. Late-mounting components (e.g.
 * InviteAcceptScreen, CheckingPaymentScreen) that call getOrCreateChat with
 * threadId=undefined would create a SECOND chat instance because the __new__
 * key is gone.
 *
 * Fix: when the first chat establishes, stash the threadId here so
 * late-mounting hooks resolve to the correct registry entry.
 * Cleared automatically on full page reload (JS runtime restarts).
 */
let resolvedDeployThreadId: string | undefined;

function useDeployChatOptions() {
  const { deploy, thread_id } = usePage<DeployProps>().props;

  // Server says no active deploy → clear stale cache from previous SPA navigation.
  // The cache will be repopulated by onThreadIdAvailable once the SDK starts a new thread.
  if (!deploy && !thread_id) {
    resolvedDeployThreadId = undefined;
  }

  // Reset cache only when the server provides a real (non-null) thread_id.
  // When thread_id is null (no active deploy), we must NOT overwrite the
  // SDK-generated threadId that onThreadIdAvailable already cached.
  if (thread_id && thread_id !== resolvedDeployThreadId) {
    resolvedDeployThreadId = thread_id;
  }

  return useChatOptions<Deploy.DeployBridgeType>({
    apiPath: "api/deploy/stream",
    merge: Deploy.MergeReducer as any,
    getInitialThreadId: () => thread_id ?? resolvedDeployThreadId,
    onThreadIdAvailable: (id) => { resolvedDeployThreadId = id; },
    includeAttachments: false,
  });
}

/**
 * Get the deploy chat instance for use with Chat.Root.
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
 * Deploy context from page props — the IDs the graph needs on every request.
 * On page reload the SDK has no accumulated state, so every updateState call
 * must include this context so the graph has correct config.
 */
export function useDeployContext() {
  const props = usePage<DeployProps>().props;
  const { website, campaign } = props;
  const projectId = props.project?.id;
  const instructions = useDeployInstructions();

  return useMemo(() => {
    const ctx = {
      projectId,
      websiteId: website?.id,
      campaignId: instructions.googleAds ? campaign?.id : undefined,
      instructions,
    };
    return ctx;
  }, [projectId, website?.id, campaign?.id, instructions]);
}

/**
 * Deploy-specific actions that wrap updateState with the deploy context.
 * Any component can call these — no prop drilling needed.
 */
export function useDeployStartDeploy() {
  const { updateState } = useDeployChatActions();
  const deployContext = useDeployContext();

  return useCallback(() => {
    updateState(deployContext);
  }, [updateState, deployContext]);
}

/**
 * Deactivate the current deploy and reload so useDeployInit auto-starts a fresh one.
 * Used by both the "Redeploy" button (complete screen) and "Retry Deploy" (error screen).
 */
export function useDeployNewDeploy() {
  const projectId = useProjectId();
  const service = useDeployService();
  const [isLoading, setIsLoading] = useState(false);

  const trigger = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      await service.deactivate(projectId);
      window.location.reload();
    } catch {
      setIsLoading(false);
    }
  }, [projectId, service]);

  return { trigger, isLoading };
}
