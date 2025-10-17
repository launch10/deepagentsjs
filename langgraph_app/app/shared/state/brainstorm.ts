import type { Brainstorm } from "@types";
import type { CoreGraphState } from "./core";
export interface BrainstormGraphState extends CoreGraphState {
    nextQuestion: Brainstorm.QuestionType;
    questionIndex: number;
    nextStep?: Brainstorm.NextStepType;
    isValidAnswer?: boolean;
    userNeedsHelp?: boolean;
}