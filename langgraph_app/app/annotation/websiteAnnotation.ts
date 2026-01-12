import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import type { PrimaryKeyType } from "@types";
import { Brainstorm, Website } from "@types";
import { Core, type ConsoleError } from "@types";

export const WebsiteAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  command: Annotation<Website.CommandName | undefined>({
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

  status: Annotation<Core.Status>({
    default: () => "pending",
    reducer: (current, next) => next,
  }),
});

export type WebsiteGraphState = typeof WebsiteAnnotation.State;
