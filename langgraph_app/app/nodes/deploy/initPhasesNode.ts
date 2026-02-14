import { type DeployGraphState, getPhasesFromState } from "@annotation";
import { getLogger } from "@core";
import { Deploy } from "@types";

/**
 * Initialize phases and pre-create tasks
 *
 * This node runs at the start of the deploy graph. It:
 * 1. Pre-creates all expected tasks as "pending" when starting a fresh deploy
 *    (so the frontend progress bar shows the full set from the start)
 * 2. Computes phases from tasks (pre-created or pre-existing from checkpoint)
 */
export function initPhasesNode(state: DeployGraphState): Partial<DeployGraphState> {
  const log = getLogger({ component: "initPhasesNode" });

  // Fresh deploy: pre-create all expected tasks as pending
  if (!state.tasks || state.tasks.length === 0) {
    const pendingTasks = state.deploy ? Deploy.createTasks(state.deploy) : [];
    if (pendingTasks.length === 0) {
      log.info("No tasks to create (no deploy instructions), marking as running");
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

  // Resumed deploy: compute phases from existing tasks
  const phases = getPhasesFromState(state);
  log.info(
    {
      taskCount: state.tasks.length,
      taskSummary: state.tasks.map((t) => ({ name: t.name, status: t.status })),
      phaseCount: phases.length,
    },
    "Computed initial phases from existing tasks"
  );
  return { phases, status: "running" };
}
