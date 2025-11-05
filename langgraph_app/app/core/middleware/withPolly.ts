import { AsyncLocalStorage } from 'node:async_hooks';
import type { NodeFunction, MinimalStateType } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { startPolly, persistRecordings } from '@utils';
import { getNodeContext } from "./withContext";
import { env } from "@core";

// withPolly doesn't take any config
type WithPollyConfig = Record<string, never>;

/**
 * Wraps a node function with polly (for testing, when we don't want to use fixtures)
 */
export const withPolly = <TState extends MinimalStateType>(
    nodeFunction: NodeFunction<TState>,
    options: WithPollyConfig
): NodeFunction<TState> => {
    return async (state: TState, config: LangGraphRunnableConfig) => {
        if (env.NODE_ENV !== 'test') {
            return nodeFunction(state, config);
        }

        const nodeCtx = getNodeContext();
        const recordingName = nodeCtx?.name || 'unknown-node-execution';

        await startPolly(recordingName);

        try {
            return await nodeFunction(state, config);
        } catch (error) {
            throw error; // Allow withError to handle the error
        } finally {
            await persistRecordings();
        }
    }
}