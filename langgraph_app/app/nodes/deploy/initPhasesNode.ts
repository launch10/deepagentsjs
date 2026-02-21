import { type DeployGraphState } from "@annotation";
import { getLogger } from "@core";
import { Deploy } from "@types";
import { GoogleAPIService, type GoogleStatus } from "@services";

/**
 * Pre-create tasks as "pending" on a fresh deploy so the frontend
 * shows the full progress bar from the start. On resume the tasks
 * already exist in state — nothing to do.
 *
 * When deploying Google Ads, checks deploy readiness to exclude
 * already-completed onboarding tasks (ConnectingGoogle, VerifyingGoogle,
 * CheckingBilling) so they never appear in the UI.
 */
export async function initPhasesNode(state: DeployGraphState): Promise<Partial<DeployGraphState>> {
  const log = getLogger({ component: "initPhasesNode" });

  log.info(
    {
      instructions: state.instructions,
      existingTaskCount: state.tasks?.length ?? 0,
      existingTaskNames: state.tasks?.map((t) => t.name) ?? [],
      deployId: state.deployId,
    },
    "initPhasesNode entry"
  );

  if (state.tasks && state.tasks.length > 0) {
    log.info("Tasks already exist, resuming");
    return { status: "running" };
  }

  // Build effective instructions: start from what the user requested,
  // then exclude anything contentChanged says hasn't changed.
  // This avoids showing tasks in the UI that will just be skipped.
  const effectiveInstructions: Deploy.Instructions = {};
  if (Deploy.shouldDeployWebsite(state)) effectiveInstructions.website = true;
  if (Deploy.shouldDeployGoogleAds(state)) effectiveInstructions.googleAds = true;

  // Check deploy readiness to exclude already-completed onboarding tasks
  const excludeNames = await getExcludedTasks(effectiveInstructions, state.jwt, log);

  const pendingTasks =
    excludeNames.length > 0
      ? Deploy.createTasksExcluding(effectiveInstructions, excludeNames)
      : Deploy.createTasks(effectiveInstructions);

  if (pendingTasks.length === 0) {
    log.info({ instructions: state.instructions }, "No tasks to create, marking as running");
    return { status: "running" };
  }

  const phases = Deploy.computePhases(pendingTasks);
  log.info(
    {
      taskCount: pendingTasks.length,
      taskNames: pendingTasks.map((t) => t.name),
      excludedTasks: excludeNames,
      phaseCount: phases.length,
    },
    "Pre-created all expected tasks as pending"
  );
  return { tasks: pendingTasks, phases, status: "running" };
}

/**
 * Check Google deploy readiness and return task names to exclude.
 * Only applies when deploying Google Ads. Gracefully degrades on failure
 * (returns empty array so all tasks are created; shouldSkip handles it).
 */
async function getExcludedTasks(
  effectiveInstructions: Deploy.Instructions,
  jwt: string | undefined,
  log: ReturnType<typeof getLogger>
): Promise<Deploy.TaskName[]> {
  if (!effectiveInstructions.googleAds) return [];
  if (!jwt) return [];

  try {
    const google = new GoogleAPIService({ jwt });
    const readiness: GoogleStatus = await google.getGoogleStatus();
    const exclude: Deploy.TaskName[] = [];

    if (readiness.google_connected) exclude.push("ConnectingGoogle");
    if (readiness.invite_accepted) exclude.push("VerifyingGoogle");
    if (readiness.has_payment) exclude.push("CheckingBilling");

    if (exclude.length > 0) {
      log.info({ readiness, exclude }, "Excluding already-completed onboarding tasks");
    }

    return exclude;
  } catch (err) {
    log.warn(
      { error: err },
      "Deploy readiness check failed — creating all tasks (graceful degradation)"
    );
    return [];
  }
}
