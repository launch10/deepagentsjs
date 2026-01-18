import { type DeployGraphState, getPhasesFromState } from "@annotation";

/**
 * Initialize phases from existing tasks
 *
 * This node runs at the start of the deploy graph to ensure phases are
 * computed from any pre-existing tasks in the state. This is primarily
 * useful for tests that start with tasks already in a terminal state.
 */
export function initPhasesNode(state: DeployGraphState): Partial<DeployGraphState> {
  // If no tasks exist, nothing to compute
  if (!state.tasks || state.tasks.length === 0) {
    return {};
  }

  // Compute phases from current tasks
  const phases = getPhasesFromState(state);
  return { phases };
}
