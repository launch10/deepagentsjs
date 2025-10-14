import type { 
    ProjectType,
    PageType,
    WebsiteType,
    FileMap, 
    CodeTaskType, 
    TaskHistoryType, 
    ComponentOverviewType,
} from "@types";
import type { CoreGraphState } from "./core";
export interface WebsiteBuilderGraphState extends CoreGraphState {
    task?: CodeTaskType;
    queue?: CodeTaskType[];
    completedTasks?: CodeTaskType[];
    componentOverviews?: ComponentOverviewType[];
    taskHistory?: TaskHistoryType[];
    project?: ProjectType;
    pages?: PageType[];
    website?: WebsiteType;
    files?: FileMap;
}