import { useEffect, useRef } from "react";
import { usePage } from "@inertiajs/react";
import { useDeployChatWithPolling } from "@hooks/useDeployChat";
import type { DeployProps } from "@hooks/useDeployChat";
import { useRootPath } from "~/stores/sessionStore";

/**
 * Deploy initialization hook. Follows the same pattern as useWebsiteInit.
 *
 * - Prevents double-init via ref (React StrictMode safe)
 * - Auto-starts deploy when no deploy exists (or pending with no thread)
 * - Touches user_active_at on mount (for OAuth callback linkage)
 */
export function useDeployInit() {
  const { deploy } = usePage<DeployProps>().props;
  const rootPath = useRootPath();
  const polling = useDeployChatWithPolling();
  const hasStarted = useRef(!!deploy?.langgraph_thread_id);

  // Touch user_active_at on mount so OAuth callback can find the active deploy
  useEffect(() => {
    if (deploy?.id && rootPath) {
      fetch(`${rootPath}/api/v1/deploys/${deploy.id}/touch`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {
        // Non-critical — just for OAuth linkage
      });
    }
  }, [deploy?.id, rootPath]);

  // Auto-start deploy if no deploy exists, or if pending with no thread (restart case)
  useEffect(() => {
    const shouldStart =
      !hasStarted.current &&
      (!deploy || (deploy.status === "pending" && !deploy.langgraph_thread_id));

    if (shouldStart) {
      hasStarted.current = true;
      polling.startDeploy();
    }
  }, [deploy, polling.startDeploy]);

  return polling;
}
