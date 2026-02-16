import { useEffect, useRef } from "react";
import { usePage } from "@inertiajs/react";
import {
  useDeployChat,
  useDeployContext,
  useDeployStartDeploy,
  type DeployProps,
} from "@hooks/useDeployChat";
import { useProjectStore } from "~/stores/projectStore";
import { useRootPath } from "~/stores/sessionStore";

/**
 * Deploy initialization hook.
 *
 * - Auto-starts deploy when no deploy exists (first visit)
 * - Resumes polling when reloading with an in-progress deploy
 * - Guards against re-invocation for terminal (completed/failed) deploys
 * - Polls the graph on an interval while deploy is running
 * - Syncs deployId from graph state to project store
 * - Touches user_active_at on mount (for OAuth callback linkage)
 */
export function useDeployInit() {
  const { deploy } = usePage<DeployProps>().props;
  const rootPath = useRootPath();
  const startDeploy = useDeployStartDeploy();
  const { updateState, state, status } = useDeployChat((s) => ({
    updateState: s.actions.updateState,
    state: s.state,
    status: s.status,
  }));
  const deployContext = useDeployContext();
  const hasActed = useRef(false);

  // Touch user_active_at on mount so OAuth callback can find the active deploy
  useEffect(() => {
    if (deploy?.id && rootPath) {
      fetch(`${rootPath}/api/v1/deploys/${deploy.id}/touch`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
  }, [deploy?.id, rootPath]);

  // Terminal: deploy already completed/failed → mark as acted so nothing re-triggers.
  // SDK history loader (GET) handles populating state for the sidebar/screen.
  // Do NOT call updateState here — that POSTs and re-invokes the graph.
  useEffect(() => {
    if (hasActed.current) return;
    const isTerminal = deploy?.status === "completed" || deploy?.status === "failed";
    if (isTerminal) {
      hasActed.current = true;
    }
  }, [deploy?.status]);

  // Auto-start: no deploy exists → kick the graph
  useEffect(() => {
    if (hasActed.current) return;
    if (!deploy) {
      hasActed.current = true;
      startDeploy();
    }
  }, [deploy, startDeploy]);

  // Resume: deploy is in-progress on page load → kick one update so polling takes over
  useEffect(() => {
    if (hasActed.current) return;
    const isInProgress = deploy?.status === "pending" || deploy?.status === "running";
    if (isInProgress) {
      hasActed.current = true;
      updateState(deployContext);
    }
  }, [deploy?.status, updateState, deployContext]);

  // Sync deployId from graph state → project store
  const setStore = useProjectStore((s) => s.set);
  useEffect(() => {
    if (state.deployId !== undefined) {
      setStore({ deployId: state.deployId });
    }
  }, [state.deployId, setStore]);

  // Poll: while deploy is running and we're not already streaming, ping the graph
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunning = state.status === "running";
  const isStreaming = status === "streaming" || status === "submitted";
  const isTerminal = state.status === "completed" || state.status === "failed";

  useEffect(() => {
    const shouldPoll = isRunning && !isStreaming;

    if (shouldPoll && !pollRef.current) {
      pollRef.current = setInterval(() => updateState(deployContext), 3000);
    }

    if ((!shouldPoll || isTerminal) && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [updateState, deployContext, isRunning, isStreaming, isTerminal]);
}
