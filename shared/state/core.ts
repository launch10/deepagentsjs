import { type ErrorStateType, type PrimaryKeyType, type BaseMessage } from "../types";

export type CoreGraphState = {
    error: ErrorStateType | undefined;
    jwt: string | undefined;
    messages: BaseMessage[];
    accountId: PrimaryKeyType | undefined;
    projectId: PrimaryKeyType | undefined;
    projectName: string | undefined;
    websiteId: PrimaryKeyType | undefined;
}