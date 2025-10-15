import type { BrainstormNextStepType, QuestionType } from "@types";
import type { CoreGraphState } from "./core";
export interface BrainstormGraphState extends CoreGraphState {
    nextQuestion: QuestionType;
    questionIndex: number;
    nextStep?: BrainstormNextStepType;
    userNeedsHelp?: boolean;
}