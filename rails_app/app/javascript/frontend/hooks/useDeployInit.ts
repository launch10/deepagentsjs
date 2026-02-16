import { useCallback, useEffect, useRef } from "react";
import { usePage } from "@inertiajs/react";
import {
  useDeployChat,
  useDeployContext,
  useDeployStartDeploy,
  type DeployProps,
} from "@hooks/useDeployChat";
import { useProjectStore } from "~/stores/projectStore";
import { useRootPath } from "~/stores/sessionStore";
import { useHasCompletedDeploy } from "@api/deploys.hooks";
import { useDeployInstructions } from "@hooks/useDeployInstructions";

/**
 * Deploy initialization hook.
 *
 * - Auto-starts deploy when no completed deploy with these instructions exists
 * - If a completed deploy with matching instructions exists, shows completed state
 * - If the active deploy has different instructions, deactivates and restarts
 * - Resumes polling when reloading with an in-progress deploy
 * - Guards against re-invocation for terminal deploys
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
  const instructions = useDeployInstructions();
  const projectId = deployContext.projectId;
  const hasActed = useRef(false);
  const isDeactivating = useRef(false);

  // Check: has this project EVER had a completed deploy with these instructions?
  const { data: hasEverCompleted, isLoading: checkingHistory } =
    useHasCompletedDeploy(projectId ?? 0, instructions);

  // Deactivate current deploy and start a fresh one (no page reload needed)
  const deactivateAndRestart = useCallback(async () => {
    if (isDeactivating.current) return;
    isDeactivating.current = true;
    try {
      const csrfToken = document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute("content");
      await fetch(`${rootPath}/api/v1/deploys/deactivate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ project_id: projectId }),
      });
      startDeploy();
    } finally {
      isDeactivating.current = false;
    }
  }, [rootPath, projectId, startDeploy]);

  // Touch user_active_at on mount so OAuth callback can find the active deploy
  useEffect(() => {
    if (deploy?.id && rootPath) {
      fetch(`${rootPath}/api/v1/deploys/${deploy.id}/touch`, {
        method: "POST",
        credentials: "include",
      }).catch(() => {});
    }
  }, [deploy?.id, rootPath]);

  // Terminal deploy logic:
  // If deploy is completed/failed, check if its instructions match the current page.
  // If they match → show completed state (mark as acted).
  // If they don't match AND we've never completed with these instructions → deactivate + restart.
  useEffect(() => {
    if (hasActed.current || checkingHistory) return;
    const isTerminal =
      deploy?.status === "completed" || deploy?.status === "failed";
    if (!isTerminal) return;

    // Check if instructions match
    const deployInstructions = deploy?.instructions ?? {};
    const instructionsMatch =
      JSON.stringify(deployInstructions) === JSON.stringify(instructions);

    if (instructionsMatch) {
      // Same instructions — show the terminal state
      hasActed.current = true;
      return;
    }

    // Different instructions — only auto-trigger if we've NEVER completed with these
    if (hasEverCompleted === false) {
      hasActed.current = true;
      deactivateAndRestart();
    } else if (hasEverCompleted === true) {
      // We HAVE completed this type before — don't auto-trigger, just show terminal state
      hasActed.current = true;
    }
    // If hasEverCompleted is undefined, we're still loading — wait
  }, [
    deploy?.status,
    deploy?.instructions,
    instructions,
    hasEverCompleted,
    checkingHistory,
    deactivateAndRestart,
  ]);

  // Auto-start: no deploy exists AND we've never completed with these instructions
  useEffect(() => {
    if (hasActed.current || checkingHistory) return;
    if (!deploy && hasEverCompleted === false) {
      hasActed.current = true;
      startDeploy();
    } else if (!deploy && hasEverCompleted === true) {
      // We've completed this type before — don't auto-start
      hasActed.current = true;
    }
  }, [deploy, startDeploy, hasEverCompleted, checkingHistory]);

  // Resume: deploy is in-progress on page load → kick one update so polling takes over
  useEffect(() => {
    if (hasActed.current) return;
    const isInProgress =
      deploy?.status === "pending" || deploy?.status === "running";
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
