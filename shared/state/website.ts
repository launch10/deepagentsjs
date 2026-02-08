import { type CoreGraphState } from "../types/graph";
import { Website, Core, type PrimaryKeyType } from "../types";
import type { Simplify } from "type-fest";
import { type BridgeType } from "langgraph-ai-sdk-types";

export interface Todo {
    content: string;
    status: "pending" | "in_progress" | "completed";
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