import { BrainstormAnnotation } from "@annotation";

export type BrainstormGraphState = typeof BrainstormAnnotation.State;
// export interface BrainstormGraphState extends CoreGraphState {
//     nextQuestion: Brainstorm.QuestionType;
//     questionIndex: number;
//     isValidAnswer?: boolean;
//     availableActions: Brainstorm.ActionType[];
//     action?: Brainstorm.ActionType;
//     route?: Brainstorm.RouteType;
//     redirect?: Graphs.RouteType;
//     projectId: PrimaryKeyType;
//     websiteId: PrimaryKeyType;
// }