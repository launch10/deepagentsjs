import { type CoreGraphState } from "../types/graph";
import { Website, Core, type PrimaryKeyType } from "../types";
import type { Simplify } from "type-fest";
import { type BridgeType, type Merge } from "langgraph-ai-sdk-types";

export interface Todo {
    id?: string;
    content: string;
    status: "pending" | "in_progress" | "completed";
}

const STATUS_PRIORITY: Record<string, number> = {
    pending: 0,
    in_progress: 1,
    completed: 2,
};

/**
 * Merge-by-id reducer with status priority.
 * Mirrors the backend todosReducer in deepagentsjs — never downgrades status,
 * so concurrent subagent patches accumulate correctly.
 */
function todosMerge(incoming: Todo[], current: Todo[] | undefined): Todo[] {
    if (!current || current.length === 0) return incoming;

    const merged = [...current];
    const mergedById = new Map(merged.map((t, i) => [t.id, i]));

    for (const todo of incoming) {
        const existingIdx = mergedById.get(todo.id);
        if (existingIdx !== undefined) {
            const prev = merged[existingIdx]!;
            const prevPriority = STATUS_PRIORITY[prev.status] ?? 0;
            const nextPriority = STATUS_PRIORITY[todo.status] ?? 0;
            if (nextPriority >= prevPriority) {
                merged[existingIdx] = todo;
            }
        } else {
            mergedById.set(todo.id, merged.length);
            merged.push(todo);
        }
    }

    return merged;
}

export type WebsiteGraphState = Simplify<CoreGraphState & {
    theme: Website.ThemeType | undefined;
    consoleErrors: Website.Errors.ConsoleError[];
    errorRetries: number;
    status: Core.Status;
    files: Website.FileMap;
    domainRecommendations: Website.DomainRecommendations.DomainRecommendations | undefined;
    todos: Todo[];
}>;

export type WebsiteBridgeType = BridgeType<WebsiteGraphState>;

export const WebsiteMergeReducer: Merge<WebsiteGraphState> = {
    todos: todosMerge,
};