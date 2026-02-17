import { useEffect, useRef } from "react";
import { usePage } from "@inertiajs/react";
import {
  useDeployChat,
  useDeployContext,
  useDeployStartDeploy,
  type DeployProps,
} from "@hooks/useDeployChat";
import { useProjectStore } from "~/stores/projectStore";
import { useHasCompletedDeploy, useDeployService } from "@api/deploys.hooks";
import { useDeployInstructions, useDeployType } from "@hooks/useDeployInstructions";

/**
 * Deploy initialization hook.
 *
 * Decides what to do on mount (start / resume / deactivate+restart / nothing),
 * then polls while a deploy is running. Also touches user_active_at on mount
 * and syncs deployId to the project store.
 */
export function useDeployInit() {
  const { deploy } = usePage<DeployProps>().props;
  const service = useDeployService();
  const startDeploy = useDeployStartDeploy();
  const { updateState, state, status } = useDeployChat((s) => ({
    updateState: s.actions.updateState,
    state: s.state,
    status: s.status,
  }));
  const deployContext = useDeployContext();
  const instructions = useDeployInstructions();
  const deployType = useDeployType();
  const projectId = deployContext.projectId;
  const hasInitialized = useRef(false);

  const { data: hasEverCompleted, isLoading: checkingHistory } =
    useHasCompletedDeploy(projectId ?? 0, deployType);

  // Touch user_active_at on mount so OAuth callback can find the active deploy
  useEffect(() => {
    if (deploy?.id) {
      service.touch(deploy.id).catch(() => {});
    }
  }, [deploy?.id, service]);

  // ── Initialize: decide what to do on mount ──
  useEffect(() => {
    if (hasInitialized.current || checkingHistory) return;

    const isInProgress =
      deploy?.status === "pending" || deploy?.status === "running";
    const isTerminal =
      deploy?.status === "completed" || deploy?.status === "failed";

    // Resume an in-progress deploy — kick one updateState so polling takes over
    if (isInProgress) {
      hasInitialized.current = true;
      updateState(deployContext);
      return;
    }

    // Terminal deploy — check if instructions match the current page
    if (isTerminal) {
      const instructionsMatch =
        JSON.stringify(deploy?.instructions ?? {}) ===
        JSON.stringify(instructions);

      if (instructionsMatch || hasEverCompleted) {
        hasInitialized.current = true;
        return; // show the terminal state as-is
      }

      if (hasEverCompleted === false) {
        hasInitialized.current = true;
        service.deactivate(projectId!).then(() => startDeploy());
        return;
      }

      return; // hasEverCompleted still loading — wait
    }

    // No deploy exists
    if (hasEverCompleted === false) {
      hasInitialized.current = true;
      startDeploy();
    } else if (hasEverCompleted === true) {
      hasInitialized.current = true;
    }
    // hasEverCompleted undefined → still loading, wait
  }, [
    deploy?.status,
    deploy?.instructions,
    instructions,
    hasEverCompleted,
    checkingHistory,
    updateState,
    deployContext,
    service,
    projectId,
    startDeploy,
  ]);

  // Sync deployId from graph state → project store
  const setStore = useProjectStore((s) => s.set);
  useEffect(() => {
    if (state.deployId !== undefined) {
      setStore({ deployId: state.deployId });
    }
  }, [state.deployId, setStore]);

  // Poll: while deploy is running and we're not already streaming, ping the graph
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunning = state.status === "running" || state.status === "pending";
  const isStreaming = status === "streaming" || status === "submitted";
  const isTerminalState = state.status === "completed" || state.status === "failed";

  useEffect(() => {
    const shouldPoll = isRunning && !isStreaming;

    if (shouldPoll && !pollRef.current) {
      pollRef.current = setInterval(() => updateState(deployContext), 3000);
    }

    if ((!shouldPoll || isTerminalState) && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [updateState, deployContext, isRunning, isStreaming, isTerminalState]);
}
