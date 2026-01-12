import { type DeployGraphState } from "@annotation";
import { Task } from "@types";

// Lightweight enqueue nodes - these checkpoint state BEFORE work begins
export const createEnqueueNode = (taskName: Task.TaskName) => {
  return async (state: DeployGraphState) => {
    console.log(`Enqueueing ${taskName}`);
    return {
      tasks: Task.enqueueTask(state.tasks, taskName),
    };
  };
};
