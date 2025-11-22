import { type PrimaryKeyType, type BaseMessage, type ThreadIDType } from ".";

export interface ErrorStateType { message: string; node: string }

export type CoreGraphState = {
    error: ErrorStateType | undefined;
    jwt: string | undefined;
    messages: BaseMessage[];
    threadId: ThreadIDType | undefined;
    accountId: PrimaryKeyType | undefined;
    projectId: PrimaryKeyType | undefined;
    projectName: string | undefined;
    websiteId: PrimaryKeyType | undefined;
}