import { type DeployGraphState, withPhases } from "@annotation";
import { Deploy, Task } from "@types";

const TASK_NAME: Deploy.TaskName = "ConnectingGoogle";

/**
 * Google Connect Node
 *
 * This is a SKIPPABLE task - if Google is already connected,
 * we skip this entirely via conditional routing in the graph.
 *
 * This node only runs when Google is NOT connected, and handles
 * the OAuth flow setup.
 */
export const googleConnectNode = async (
  state: DeployGraphState
): Promise<Partial<DeployGraphState>> => {
  const task = Task.findTask(state.tasks, TASK_NAME);

  // Idempotent: skip if already completed
  if (task?.status === "completed") {
    return {};
  }

  // TODO: Implement actual OAuth flow trigger here
  // For now, this is a placeholder that marks the task as needing user action
  console.log(`[GoogleConnect] Initiating Google OAuth flow...`);

  // In reality, this would:
  // 1. Generate OAuth URL
  // 2. Return a result that tells frontend to redirect user
  // 3. Wait for OAuth callback to complete the task

  return withPhases(
    state,
    [
      {
        ...task,
        status: "running", // Waiting for user to complete OAuth
        result: {
          action: "oauth_required",
          message: "Please connect your Google Ads account",
        },
      } as Task.Task,
    ],
    ["ConnectingGoogle"]
  );
};

/**
 * Check if Google is already connected for this account
 *
 * This function is used by the graph's conditional routing to decide
 * whether to skip the GoogleConnect task entirely.
 *
 * @param state - Current graph state
 * @returns true if Google is connected (skip the task), false otherwise
 */
export async function isGoogleConnected(state: DeployGraphState): Promise<boolean> {
  // TODO: Replace with actual API call
  // const adsAccount = await adsAccountApi.findByAccountId(state.accountId);
  // return adsAccount?.google_connected ?? false;

  // Placeholder: check if we have a campaignId (implies Google is connected)
  // In reality, this should check the ads_account table
  const hasExistingCampaign = state.campaignId !== undefined;

  console.log(
    `[GoogleConnect] Checking if Google connected: ${hasExistingCampaign ? "YES (skipping)" : "NO (needs OAuth)"}`
  );

  return hasExistingCampaign;
}

/**
 * Conditional routing function for skippable Google tasks
 *
 * Usage in graph:
 * ```
 * .addConditionalEdges("previousNode", shouldSkipGoogleConnect)
 * ```
 */
export async function shouldSkipGoogleConnect(
  state: DeployGraphState
): Promise<"skipGoogleConnect" | "enqueueGoogleConnect"> {
  const connected = await isGoogleConnected(state);
  return connected ? "skipGoogleConnect" : "enqueueGoogleConnect";
}
