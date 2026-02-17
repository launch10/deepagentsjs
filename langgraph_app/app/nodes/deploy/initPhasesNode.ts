import { type DeployGraphState } from "@annotation";
import { getLogger } from "@core";
import { Deploy } from "@types";

/**
 * Pre-create tasks as "pending" on a fresh deploy so the frontend
 * shows the full progress bar from the start. On resume the tasks
 * already exist in state — nothing to do.
 */
export function initPhasesNode(state: DeployGraphState): Partial<DeployGraphState> {
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

  log.info(
    {
      contentChanged: state.contentChanged,
      shouldDeployWebsite: Deploy.shouldDeployWebsite(state),
      shouldDeployGoogleAds: Deploy.shouldDeployGoogleAds(state),
      effectiveInstructions,
    },
    "Effective instructions after contentChanged filter"
  );

  const pendingTasks = Deploy.createTasks(effectiveInstructions);
  if (pendingTasks.length === 0) {
    log.info({ instructions: state.instructions }, "No tasks to create, marking as running");
    return { status: "running" };
  }

  const phases = Deploy.computePhases(pendingTasks);
  log.info(
    {
      taskCount: pendingTasks.length,
      taskNames: pendingTasks.map((t) => t.name),
      phaseCount: phases.length,
    },
    "Pre-created all expected tasks as pending"
  );
  return { tasks: pendingTasks, phases, status: "running" };
}
