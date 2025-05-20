import type { ProjectData } from "@models/project";
import type { PageData } from "@models/page";
import type { FileMap } from "@models/file";
import type { CodeTask } from "@models/codeTask";
import type { CompletedCodeTask } from "@models/codeTask";
import type { TaskHistoryType } from "@models/taskHistory";
import type { BaseMessageLike } from "@langchain/core/messages";
import type { BaseMessage, HumanMessage } from "@langchain/core/messages";
export interface CodeTasksState {
    queue: CodeTask[];
    completedTasks: CompletedCodeTask[];
    taskHistory?: TaskHistoryType;
}
export interface App {
    project: ProjectData | undefined;
    page: PageData | undefined;
    files: FileMap;
    codeTasks?: CodeTasksState;
    error?: string;
    success?: boolean;
}

export interface GraphState {
    tenantId: number;
    projectName: string;
    isFirstMessage: boolean;
    userRequest: HumanMessage; 
    messages: BaseMessage[];
    currentError?: string; 
    app: App;
    task: CodeTask;
}
