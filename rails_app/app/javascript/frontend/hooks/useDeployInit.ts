import { useEffect, useRef } from "react";
import { usePage } from "@inertiajs/react";
import {
  useDeployChat,
  useDeployContext,
  useDeployStartDeploy,
  type DeployProps,
} from "@hooks/useDeployChat";
import { useProjectStore } from "~/stores/projectStore";
import { useDeployService } from "@api/deploys.hooks";
import { logger } from "@lib/logger";

/**
 * Deploy initialization hook.
 *
 * Decides what to do on mount (start / resume / nothing),
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
  const hasInitialized = useRef(false);

  // Touch user_active_at on mount so OAuth callback can find the active deploy
  useEffect(() => {
    if (deploy?.id) {
      service.touch(deploy.id).catch(() => {});
    }
  }, [deploy?.id, service]);

  // ── Initialize: decide what to do on mount ──
  useEffect(() => {
    logger.debug("DeployInit", "deploy prop:", deploy);
    logger.debug("DeployInit", "hasInitialized:", hasInitialized.current);
    if (hasInitialized.current) return;

    const isInProgress =
      deploy?.status === "pending" || deploy?.status === "running";
    const isTerminal =
      deploy?.status === "completed" || deploy?.status === "failed";

    // 1. Resume an in-progress deploy
    if (isInProgress) {
      logger.info("DeployInit", "Resuming in-progress deploy");
      hasInitialized.current = true;
      updateState(deployContext);
      return;
    }

    // 2. Show terminal state as-is
    if (isTerminal) {
      logger.info("DeployInit", "Terminal state, skipping init");
      hasInitialized.current = true;
      return;
    }

    // 3. No deploy exists — start fresh
    //    (first visit OR after redeploy deactivated the old one)
    hasInitialized.current = true;
    logger.info("DeployInit", "Starting fresh deploy");
    startDeploy();
  }, [deploy?.status, updateState, deployContext, startDeploy]);

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
