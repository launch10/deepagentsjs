import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import type { Equal, Expect, PrimaryKeyType, ShowMismatches } from "@types";
import { Brainstorm, Website, Core } from "@types";
import { createAppBridge } from "@api/middleware";
import { todosMerge } from "@state";

export const WebsiteAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,

  theme: Annotation<Website.ThemeType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),

  // Current theme ID — streamed to frontend so the theme picker stays in sync
  // when the coding agent creates a new theme via change_color_scheme tool.
  themeId: Annotation<PrimaryKeyType | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,
  }),

  consoleErrors: Annotation<Website.Errors.ConsoleError[]>({
    default: () => [],
    reducer: (current, next) => next,
  }),

  errorRetries: Annotation<number>({
    default: () => 0,
    reducer: (current, next) => next,
  }),

  status: Annotation<Core.Status>({
    default: () => "pending",
    reducer: (current, next) => next,
  }),

  // Files synced from database via syncWebsiteChanges node after agent completes
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
  // Uses shared todosMerge: merge-by-id with status-priority (completed > in_progress > pending)
  todos: Annotation<Array<{ id: string; content: string; status: "pending" | "in_progress" | "completed" }>>({
    default: () => [],
    reducer: (current, next) => todosMerge(next, current) as typeof current,
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
