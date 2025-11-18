import { type ErrorStateType, type PrimaryKeyType, type BaseMessage, type ThreadIDType } from "../types";

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