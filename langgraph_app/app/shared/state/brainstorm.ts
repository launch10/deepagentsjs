import type { Brainstorm, Graphs, PrimaryKeyType } from "@types";
import type { CoreGraphState } from "./core";
export interface BrainstormGraphState extends CoreGraphState {
    nextQuestion: Brainstorm.QuestionType;
    questionIndex: number;
    isValidAnswer?: boolean;
    availableActions: Brainstorm.ActionType[];
    action?: Brainstorm.ActionType;
    route?: Brainstorm.RouteType;
    redirect?: Graphs.RouteType;
    projectId: PrimaryKeyType;
    websiteId: PrimaryKeyType;
}