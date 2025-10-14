import type { BrainstormNextStepType, QuestionType } from "@types";
import type { BaseMessage } from "@langchain/core/messages";

export interface BrainstormGraphState {
    error?: string;
    jwt?: string;
    accountId?: number;
    messages: BaseMessage[];
    nextQuestion: QuestionType;
    nextStep?: BrainstormNextStepType;
    questionIndex: number;
}