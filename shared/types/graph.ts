import type {
    BaseMessage
} from "@langchain/core/messages";

export interface ErrorStateType { message: string; node: string }
export interface MinimalGraphState {
    error: ErrorStateType | undefined;
    jwt: string | undefined;
    messages: BaseMessage[] | undefined;
}
export interface CoreGraphState extends MinimalGraphState {
    accountId: number | undefined;
    projectId: number | undefined;
    projectName: string | undefined;
}