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
  todos: Annotation<Array<{ id: string; content: string; status: "pending" | "in_progress" | "completed" }>>({
    default: () => [],
    reducer: (current, next) => {
      // Merge-by-id reducer: allows parallel subagent todo updates
      // without last-writer-wins race conditions
      if (!next) return current || [];
      if (!current || current.length === 0) {
        console.debug("[todosReducer] initial set", {
          count: next.length,
          ids: next.map((t) => t.id?.slice(0, 8)),
        });
        return next;
      }

      const merged = [...current];
      const mergedById = new Map(merged.map((t, i) => [t.id, i]));
      const updates: string[] = [];
      const appends: string[] = [];

      const STATUS_PRIORITY: Record<string, number> = { pending: 0, in_progress: 1, completed: 2 };

      for (const todo of next) {
        const existingIdx = mergedById.get(todo.id);
        if (existingIdx !== undefined) {
          const prev = merged[existingIdx];
          const prevPriority = STATUS_PRIORITY[prev.status] ?? 0;
          const nextPriority = STATUS_PRIORITY[todo.status] ?? 0;
          // Never downgrade status — parallel subagents have stale snapshots
          if (nextPriority >= prevPriority) {
            if (prev.status !== todo.status) {
              updates.push(`${todo.id.slice(0, 8)}: ${prev.status} → ${todo.status}`);
            }
            merged[existingIdx] = todo;
          } else {
            updates.push(`${todo.id.slice(0, 8)}: BLOCKED downgrade ${prev.status} → ${todo.status}`);
          }
        } else {
          appends.push(`${todo.id.slice(0, 8)}: ${todo.status}`);
          mergedById.set(todo.id, merged.length);
          merged.push(todo);
        }
      }

      console.debug("[todosReducer] merge", {
        currentCount: current.length,
        updateCount: next.length,
        mergedCount: merged.length,
        statusChanges: updates,
        newTodos: appends,
      });

      return merged;
    },
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
