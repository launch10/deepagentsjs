import { type CoreGraphState } from "../types/graph";
import { type ComponentContentPlanType, type ComponentOverviewType, type ProjectType, type WebsiteType, type ConsoleError, type FileMap } from "../types";
import type { Simplify } from "type-fest";

export type WebsiteGraphState = Simplify<CoreGraphState & {
    contentPlan: ComponentContentPlanType | undefined;
    project: ProjectType | undefined;
    website: WebsiteType | undefined;
    componentOverviews: ComponentOverviewType[];
    files: FileMap;
    consoleErrors: ConsoleError[];
}>;