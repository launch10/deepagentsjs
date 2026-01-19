import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import type { PrimaryKeyType } from "@types";
import { Brainstorm, Website, Core, type ConsoleError } from "@types";
import { createBridge } from "langgraph-ai-sdk";

export const WebsiteAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  command: Annotation<Website.CommandName | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  improveCopyStyle: Annotation<Website.ImproveCopyStyle | undefined>({
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

  images: Annotation<Website.Image[]>({
    default: () => [],
    reducer: (current, next) => next,
  }),

  consoleErrors: Annotation<Website.Errors.ConsoleError[]>({
    default: () => [],
    reducer: (current, next) => [...current, ...next],
  }),

  errorRetries: Annotation<number>({
    default: () => 0,
    reducer: (current, next) => next,
  }),

  status: Annotation<Core.Status>({
    default: () => "pending",
    reducer: (current, next) => next,
  }),

  // Files synced from database via syncFilesToState node after agent completes
  // FileData format: { content: string[], created_at: string, modified_at: string }
  files: Annotation<Website.FileMap>({
    default: () => ({}),
    reducer: (current, next) => ({ ...current, ...next }),
  }),
});

export type WebsiteGraphState = typeof WebsiteAnnotation.State;

// Bridge from Langgraph -> the AI SDK for streaming to frontend
export const WebsiteBridge = createBridge({
  endpoint: "/api/website/stream",
  stateAnnotation: WebsiteAnnotation,
});
