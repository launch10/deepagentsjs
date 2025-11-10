import type {
    Message
} from ".";

export interface ErrorStateType { message: string; node: string }
export interface MinimalGraphState {
    error: ErrorStateType | undefined;
    jwt: string | undefined;
    messages: Message[] | undefined;
}
export interface CoreGraphState extends MinimalGraphState {
    accountId: number | undefined;
    projectId: number | undefined;
    projectName: string | undefined;
}