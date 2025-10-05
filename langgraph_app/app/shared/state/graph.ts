import type { 
    ProjectType,
    PageType,
    WebsiteType,
    FileMap, 
    CodeTaskType, 
    TaskHistoryType, 
    ComponentOverviewType,
    ConsoleError,
} from "@types";
import type { BaseMessage } from "@langchain/core/messages";
export interface GraphState {
    error?: string;
    jwt?: string;
    accountId?: number;
    projectName?: string;
    messages: BaseMessage[];
    task?: CodeTaskType;
    queue?: CodeTaskType[];
    completedTasks?: CodeTaskType[];
    componentOverviews?: ComponentOverviewType[];
    taskHistory?: TaskHistoryType[];
    project?: ProjectType;
    pages?: PageType[];
    website?: WebsiteType;
    files?: FileMap;
    consoleErrors: ConsoleError[];
}