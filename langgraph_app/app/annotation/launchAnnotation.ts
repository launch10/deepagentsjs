import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";

import type { PrimaryKeyType } from "@types";

export interface JobRunCompleteState {
  jobRunId: number;
  status: "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
}

export const LaunchAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  campaignId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Job run state from webhook callback
  jobRunComplete: Annotation<JobRunCompleteState | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Deploy status
  deployStatus: Annotation<"pending" | "running" | "completed" | "failed" | undefined>({
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
