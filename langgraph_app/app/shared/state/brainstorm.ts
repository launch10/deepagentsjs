import type { BrainstormNextStepType } from "@types";
import type { BaseMessage } from "@langchain/core/messages";

export interface BrainstormGraphState {
    error?: string;
    jwt?: string;
    accountId?: number;
    messages: BaseMessage[];
    nextStep?: BrainstormNextStepType;
    questionIndex: number;
}