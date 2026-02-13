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

type TaskState = Deploy.DeployGraphState["tasks"];
type DeployStatus = Deploy.DeployGraphState["status"];

/**
 * Pure function that resolves which content screen to show based on deploy state.
 *
 * Priority order:
 * 1. Terminal states (completed, failed)
 * 2. Task-specific blocking states (OAuth, invite, payment)
 * 3. Default in-progress
 */
export function resolveContentScreen(tasks: TaskState, status: DeployStatus): DeployScreen {
  // Terminal states first
  if (status === "completed") return "deploy-complete";
  if (status === "failed") return "deploy-error";

  if (!tasks || tasks.length === 0) return "in-progress";

  // Check ConnectingGoogle — OAuth required
  const connectTask = tasks.find((t) => t.name === "ConnectingGoogle");
  if (
    connectTask?.status === "running" &&
    connectTask.result?.action === "oauth_required" &&
    !connectTask.result?.google_email
  ) {
    return "google-connect";
  }

  // Check VerifyingGoogle — invite acceptance
  const verifyTask = tasks.find((t) => t.name === "VerifyingGoogle");
  if (verifyTask?.status === "running" && !verifyTask.result?.status) {
    return "invite-accept";
  }

  // Check CheckingBilling — payment flow
  const billingTask = tasks.find((t) => t.name === "CheckingBilling");
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
 */
export function useDeployContentScreen(state: Partial<Deploy.DeployGraphState>): DeployScreen {
  return useMemo(
    () => resolveContentScreen(state.tasks, state.status),
    [state.tasks, state.status]
  );
}
