import { type DeployGraphState, getPhasesFromState } from "@annotation";
import { getLogger } from "@core";

/**
 * Initialize phases from existing tasks
 *
 * This node runs at the start of the deploy graph to ensure phases are
 * computed from any pre-existing tasks in the state. This is primarily
 * useful for tests that start with tasks already in a terminal state.
 */
export function initPhasesNode(state: DeployGraphState): Partial<DeployGraphState> {
  const log = getLogger({ component: "initPhasesNode" });

  // If no tasks exist, nothing to compute — but still mark as running
  if (!state.tasks || state.tasks.length === 0) {
    log.info("No existing tasks, skipping phase computation");
    return { status: "running" };
  }

  // Compute phases from current tasks
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
