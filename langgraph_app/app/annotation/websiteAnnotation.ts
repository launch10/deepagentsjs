import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import type { Equal, Expect, PrimaryKeyType, ShowMismatches } from "@types";
import { Brainstorm, Website, Core } from "@types";
import { createAppBridge } from "@api/middleware";

export const WebsiteAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  theme: Annotation<Website.ThemeType | undefined>({
    default: () => undefined,
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

  // Domain recommendations (computed idempotently by domainRecommendations node)
  domainRecommendations: Annotation<
    Website.DomainRecommendations.DomainRecommendations | undefined
  >({
    default: () => undefined,
    reducer: (current, next) => next ?? current, // Don't overwrite if already set
  }),

  // Todo list for progress tracking (populated by deepagents' write_todos tool)
  todos: Annotation<Array<{ content: string; status: "pending" | "in_progress" | "completed" }>>({
    default: () => [],
    reducer: (current, next) => next, // Full replacement on each update
  }),
});

export type WebsiteGraphState = typeof WebsiteAnnotation.State;

type _Mismatches = ShowMismatches<WebsiteGraphState, typeof WebsiteAnnotation.State>;
type _Assertion = Expect<Equal<WebsiteGraphState, typeof WebsiteAnnotation.State>>;

// Bridge for streaming frontend - uses createAppBridge for automatic usage tracking
export const WebsiteBridge = createAppBridge({
  endpoint: "/api/website/stream",
  stateAnnotation: WebsiteAnnotation,
});
