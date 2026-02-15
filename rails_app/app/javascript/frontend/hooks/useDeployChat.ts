import { usePage } from "@inertiajs/react";
import { useCallback, useMemo, useState } from "react";
import { useLanggraph, type ChatSnapshot, type LanggraphChat } from "langgraph-ai-sdk-react";
import type { UIMessage } from "ai";
import { Deploy, type InertiaProps } from "@shared";
import { useChatOptions } from "@hooks/useChatOptions";
import { useDeployInstructions } from "@hooks/useDeployInstructions";
import { useProjectId } from "~/stores/projectStore";

export interface WebsiteDeployRecord {
  id: number;
  status: string;
  environment: string;
  is_live: boolean;
  revertible: boolean;
  created_at: string;
}

export type DeployProps =
  InertiaProps.paths["/projects/{uuid}/deploy"]["get"]["responses"]["200"]["content"]["application/json"];

export type DeploySnapshot = ChatSnapshot<Deploy.DeployGraphState>;

function useDeployChatOptions() {
  const { thread_id } = usePage<DeployProps>().props;

  return useChatOptions<Deploy.DeployBridgeType>({
    apiPath: "api/deploy/stream",
    merge: Deploy.MergeReducer as any,
    getInitialThreadId: () => thread_id ?? undefined,
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

  return useMemo(
    () => ({
      projectId,
      websiteId: website?.id,
      campaignId: instructions.googleAds ? campaign?.id : undefined,
      instructions,
    }),
    [projectId, website?.id, campaign?.id, instructions]
  );
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
  const [isLoading, setIsLoading] = useState(false);

  const trigger = useCallback(async () => {
    setIsLoading(true);
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
      await fetch("/api/v1/deploys/deactivate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ project_id: projectId }),
      });
      window.location.reload();
    } catch {
      setIsLoading(false);
    }
  }, [projectId]);

  return { trigger, isLoading };
}
