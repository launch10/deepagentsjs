import { useMemo } from "react";
import type { Deploy } from "@shared";

export type DeployScreen =
  | "in-progress"
  | "google-connect"
  | "invite-accept"
  | "payment-required"
  | "checking-payment"
  | "payment-confirmed"
  | "waiting-google"
  | "deploy-complete"
  | "deploy-error";

type TaskState = Deploy.DeployGraphState["tasks"] | undefined;
type DeployStatus = Deploy.DeployGraphState["status"];

/**
 * Pure function that resolves which content screen to show based on deploy state.
 *
 * Priority order:
 * 1. Terminal states (from langgraph state or Rails deploy record)
 * 2. Task-specific blocking states (OAuth, invite, payment)
 * 3. Default in-progress
 */
export function resolveContentScreen(
  tasks: TaskState,
  status: DeployStatus,
  instructions: Deploy.DeployGraphState["instructions"],
  railsDeployStatus?: string
): DeployScreen {
  // Terminal states — check both langgraph state and Rails record
  // Rails status is the fallback for page reloads before langgraph state loads
  if (status === "completed" || railsDeployStatus === "completed") return "deploy-complete";
  if (status === "failed" || railsDeployStatus === "failed") return "deploy-error";

  if (!tasks || tasks.length === 0) return "in-progress";

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
  railsDeployStatus?: string
): DeployScreen {
  return useMemo(
    () => resolveContentScreen(state.tasks, state.status, state.instructions, railsDeployStatus),
    [state.tasks, state.status, state.instructions, railsDeployStatus]
  );
}
