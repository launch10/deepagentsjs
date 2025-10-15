import type { 
    ConsoleError,
    Message
} from "@types";
export interface CoreGraphState {
    error?: string;
    jwt?: string;
    accountId?: number;
    projectName?: string;
    messages?: Message[];
    consoleErrors?: ConsoleError[];
}