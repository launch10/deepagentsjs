import { type DeployGraphState, withPhases } from "@annotation";
import { Deploy } from "@types";

// Lightweight enqueue nodes - these checkpoint state BEFORE work begins
// Also computes phases so frontend always has up-to-date phase status
export const createEnqueueNode = (taskName: Deploy.TaskName) => {
  return async (state: DeployGraphState) => {
    console.log(`Enqueueing ${taskName}`);
    const enqueuedTasks = Deploy.enqueueTask(state.tasks, taskName);

    // Find the newly created/updated task to pass to withPhases
    const task = enqueuedTasks.find((t) => t.name === taskName);
    if (!task) {
      return { tasks: enqueuedTasks };
    }

    return withPhases({ tasks: state.tasks }, [task]);
  };
};
