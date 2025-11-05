import type { 
    ConsoleError,
    Message
} from "@types";

export interface ErrorStateType { message: string; node: string }
export interface MinimalGraphState {
    error?: ErrorStateType;
    jwt?: string;
    messages?: Message[];
}
export interface CoreGraphState extends MinimalGraphState {
    accountId?: number;
    projectId?: number;
    projectName?: string;
    consoleErrors?: ConsoleError[];
}