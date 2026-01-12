import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import type { PrimaryKeyType, Task, ConsoleError, Deploy } from "@types";

export const DeployAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  // Final deploy status for frontend
  status: Annotation<Deploy.Status | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Deploy result from the job
  result: Annotation<Record<string, unknown> | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Boolean flags for what to deploy
  deploy: Annotation<Deploy.Instructions>({
    default: () => ({ }),
    reducer: (current, next) => next ?? current,
  }),

  // IDs (websiteId already in BaseAnnotation)
  campaignId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),
  consoleErrors: Annotation<ConsoleError[]>({
    default: () => [],
    reducer: (current, next) => next,
  }),

  // Task tracking - ALL state lives here
  tasks: Annotation<Task.Task[]>({
    default: () => [],
    reducer: (current, next) => {
      const taskMap = new Map(current.map((t) => [t.name, t]));
      for (const task of next) {
        taskMap.set(task.name, { ...taskMap.get(task.name), ...task });
      }
      return Array.from(taskMap.values());
    },
  }),
});

export type DeployGraphState = typeof DeployAnnotation.State;
