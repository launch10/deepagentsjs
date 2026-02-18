import { useMemo } from "react";
import type { Deploy } from "@shared";
import { logger } from "@lib/logger";

export type DeployScreen =
  | "in-progress"
  | "google-connect"
  | "invite-accept"
  | "payment-required"
  | "checking-payment"
  | "payment-confirmed"
  | "waiting-google"
  | "deploy-complete"
  | "deploy-error"
  | "connection-error";

type TaskState = Deploy.DeployGraphState["tasks"] | undefined;
type DeployStatus = Deploy.DeployGraphState["status"];

/**
 * Pure function that resolves which content screen to show based on deploy state.
 *
 * Priority order:
 * 1. Terminal states (from langgraph state or Rails deploy record)
 *    — Rails status is only used when the deploy's instructions match the page's expectations.
 *      A stale deploy with different instructions is ignored.
 * 2. Task-specific blocking states (OAuth, invite, payment)
 * 3. Default in-progress
 */
export function resolveContentScreen(
  tasks: TaskState,
  status: DeployStatus,
  instructions: Deploy.DeployGraphState["instructions"],
  railsDeployStatus?: string,
  railsDeployInstructions?: Record<string, boolean>,
  pageInstructions?: Record<string, boolean>,
  historyFailed?: boolean
): DeployScreen {
  // Only trust Rails deploy status when its instructions match what this page expects.
  // Semantic comparison: every key the page cares about must match the Rails value.
  // This handles key-order differences and extra keys (e.g. explicit false) in Rails.
  const railsInstructionsMatch =
    !!railsDeployInstructions &&
    !!pageInstructions &&
    Object.entries(pageInstructions).every(
      ([key, value]) => railsDeployInstructions[key] === value
    );

  const effectiveRailsStatus = railsInstructionsMatch ? railsDeployStatus : undefined;

  // Terminal states — check both langgraph state and Rails record
  // Rails status is the fallback for page reloads before langgraph state loads
  if (status === "completed" || effectiveRailsStatus === "completed") {
    logger.debug("DeployScreen", "resolved: deploy-complete", {
      graphStatus: status, railsStatus: effectiveRailsStatus,
    });
    return "deploy-complete";
  }
  if (status === "failed" || effectiveRailsStatus === "failed") {
    logger.debug("DeployScreen", "resolved: deploy-error", {
      graphStatus: status, railsStatus: effectiveRailsStatus,
    });
    return "deploy-error";
  }

  // Connection error — history loading exhausted retries
  if (historyFailed && (!tasks || tasks.length === 0)) {
    logger.debug("DeployScreen", "resolved: connection-error", {
      graphStatus: status, railsStatus: effectiveRailsStatus,
    });
    return "connection-error";
  }

  if (!tasks || tasks.length === 0) {
    logger.debug("DeployScreen", "resolved: in-progress", {
      taskCount: tasks?.length ?? "undefined",
      graphStatus: status,
      railsStatus: effectiveRailsStatus,
    });
    return "in-progress";
  }

  // Check ConnectingGoogle — OAuth required
  const connectTask = instructions.googleAds
    ? tasks.find((t) => t.name === "ConnectingGoogle")
    : undefined;
  if (
    connectTask?.status === "running" &&
    connectTask.result?.action === "oauth_required" &&
    !connectTask.result?.google_email
  ) {
    return "google-connect";
  }

  // Check VerifyingGoogle — invite acceptance
  const verifyTask = instructions.googleAds
    ? tasks.find((t) => t.name === "VerifyingGoogle")
    : undefined;
  if (verifyTask?.status === "running" && !verifyTask.result?.status) {
    return "invite-accept";
  }

  // Check CheckingBilling — payment flow
  const billingTask = instructions.googleAds
    ? tasks.find((t) => t.name === "CheckingBilling")
    : undefined;
  if (billingTask?.status === "running") {
    if (billingTask.result?.has_payment === true) {
      return "payment-confirmed";
    }
    if (billingTask.result?.action === "checking_payment") {
      return "checking-payment";
    }
    if (billingTask.result?.action === "payment_required") {
      return "payment-required";
    }
    if (billingTask.result?.action === "waiting_google") {
      return "waiting-google";
    }
    // Default: billing task is running but no specific action yet
    return "checking-payment";
  }

  return "in-progress";
}

/**
 * Hook that returns the current content screen based on deploy chat state.
 * Accepts Partial state since useLanggraph returns partial state initially.
 * Falls back to Rails deploy status for immediate rendering on page reload.
 */
export function useDeployContentScreen(
  state: Partial<Deploy.DeployGraphState>,
  railsDeployStatus?: string,
  railsDeployInstructions?: Record<string, boolean>,
  pageInstructions?: Record<string, boolean>,
  historyFailed?: boolean
): DeployScreen {
  return useMemo(
    () =>
      resolveContentScreen(
        state.tasks,
        state.status,
        state.instructions ?? {},
        railsDeployStatus,
        railsDeployInstructions,
        pageInstructions,
        historyFailed
      ),
    [state.tasks, state.status, state.instructions, railsDeployStatus, railsDeployInstructions, pageInstructions, historyFailed]
  );
}
