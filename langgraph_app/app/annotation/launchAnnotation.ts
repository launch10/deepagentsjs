import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";

import type { PrimaryKeyType, AsyncTask } from "@types";

export const LaunchAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  // Campaign to deploy
  campaignId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Task tracking for idempotency
  // Each task represents a background job (e.g., deployCampaign)
  // The merge reducer allows multiple updates to the same task
  tasks: Annotation<AsyncTask[]>({
    default: () => [],
    reducer: (current, next) => {
      // Merge by task name - next values override current
      const taskMap = new Map(current.map((t) => [t.name, t]));
      for (const task of next) {
        taskMap.set(task.name, { ...taskMap.get(task.name), ...task });
      }
      return Array.from(taskMap.values());
    },
  }),

  // Final deploy status for frontend
  deployStatus: Annotation<"pending" | "completed" | "failed" | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Deploy result from the job
  deployResult: Annotation<Record<string, unknown> | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),
});

export type LaunchGraphState = typeof LaunchAnnotation.State;
