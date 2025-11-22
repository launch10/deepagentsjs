import { type CoreGraphState } from "../types/graph";
import { type CodeTaskType, type ComponentContentPlanType, type TaskHistoryType, type ComponentOverviewType, type ProjectType, type WebsiteType, type ConsoleError, type FileMap } from "../types";
import type { Simplify } from "type-fest";

export type WebsiteGraphState = Simplify<CoreGraphState & {
    task: CodeTaskType | undefined;
    contentPlan: ComponentContentPlanType | undefined;
    queue: CodeTaskType[];
    completedTasks: CodeTaskType[];
    taskHistory: TaskHistoryType[];
    project: ProjectType | undefined;
    website: WebsiteType | undefined;
    componentOverviews: ComponentOverviewType[];
    files: FileMap;
    consoleErrors: ConsoleError[];
}>;