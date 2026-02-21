import { type PrimaryKeyType, type BaseMessage, type ThreadIDType, type Intent, type AgentIntent } from ".";

export interface ErrorStateType { message: string; node: string }

/**
 * Credit status result for frontend consumption.
 * Calculated at the end of a graph run to notify users of exhaustion.
 */
export interface CreditStatus {
    /** true if user just went from positive to zero/negative credits */
    justExhausted: boolean;
    /** Estimated remaining credits after this run in millicredits */
    estimatedRemainingMillicredits: number;
    /** Balance before the run in millicredits (for debugging) */
    preRunMillicredits: number;
    /** Estimated cost of the run in millicredits (for debugging) */
    estimatedCostMillicredits: number;
}

export type CoreGraphState = {
    error: ErrorStateType | undefined;
    jwt: string | undefined;
    messages: BaseMessage[];
    threadId: ThreadIDType | undefined;
    accountId: PrimaryKeyType | undefined;
    projectId: PrimaryKeyType | undefined;
    projectName: string | undefined;
    websiteId: PrimaryKeyType | undefined;
    chatId: PrimaryKeyType | undefined;
    /** Pre-run credit balance in millicredits (set by middleware) */
    preRunCreditsRemaining: number | undefined;
    /** Credit status calculated at end of run (for frontend exhaustion notification) */
    creditStatus: CreditStatus | undefined;
    /** Intent: user action that triggered this graph invocation (consumed after handling) */
    intent: Intent | undefined;
    /** Agent intents: actions the agent wants the frontend to execute */
    agentIntents: AgentIntent[] | undefined;
}