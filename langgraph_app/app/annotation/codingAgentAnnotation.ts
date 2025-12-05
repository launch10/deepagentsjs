import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import type { PrimaryKeyType } from "@types";
import { Brainstorm, Website } from "@types";

export interface ConsoleError {
  message: string;
  stack?: string;
  timestamp: string;
}

export interface CodingAgentContext {
  brainstorm: Brainstorm.MemoriesType;
  theme: Website.ThemeType;
  images: Array<{ url: string; isLogo: boolean }>;
}

export const CodingAgentAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  workDir: Annotation<string | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  brainstormId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  brainstorm: Annotation<Brainstorm.MemoriesType>({
    default: () => ({}),
    reducer: (current, next) => next,
  }),

  theme: Annotation<Website.ThemeType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  images: Annotation<Array<{ url: string; isLogo: boolean }>>({
    default: () => [],
    reducer: (current, next) => next,
  }),

  consoleErrors: Annotation<ConsoleError[]>({
    default: () => [],
    reducer: (current, next) => [...current, ...next],
  }),

  errorRetries: Annotation<number>({
    default: () => 0,
    reducer: (current, next) => next,
  }),

  status: Annotation<"initializing" | "running" | "completed" | "error">({
    default: () => "initializing",
    reducer: (current, next) => next,
  }),
});

export type CodingAgentGraphState = typeof CodingAgentAnnotation.State;
