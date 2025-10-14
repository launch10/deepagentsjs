import type { 
    ConsoleError,
} from "@types";

import type { BaseMessage } from "@langchain/core/messages";

export interface CoreGraphState {
    error?: string;
    jwt?: string;
    accountId?: number;
    projectName?: string;
    messages?: BaseMessage[];
    consoleErrors?: ConsoleError[];
}