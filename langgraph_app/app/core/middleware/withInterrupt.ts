import { AsyncLocalStorage } from 'node:async_hooks';
import { interrupt } from "@langchain/langgraph";
import { env } from "@core";
import type { NodeFunction, MinimalStateType } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getNodeContext } from "./withContext";

export interface InterruptContext {
    nodeName: string;
}

export const interruptContext = new AsyncLocalStorage<InterruptContext>();
export const getInterruptContext = () => interruptContext.getStore();

type WithInterruptConfig = Record<string, never>;

// Track which node we should interrupt after
let pendingInterruptAfterNode: string | null = null;

// Export a function to reset the interrupt state (for tests)
export function resetInterruptState() {
    pendingInterruptAfterNode = null;
}

export class TestInterruptError extends Error {
    public readonly node: string;
    public readonly state: any;
    public readonly when: 'before' | 'after';
    
    constructor(node: string, state: any, when: 'before' | 'after') {
        super(`Test interrupt ${when} ${node}`);
        this.name = 'TestInterruptError';
        this.node = node;
        this.state = state;
        this.when = when;
    }
}

export const withInterrupt = <TState extends MinimalStateType>(
    nodeFunction: NodeFunction<TState>,
    options: WithInterruptConfig = {}
): NodeFunction<TState> => {
    return async (state: TState, config: LangGraphRunnableConfig) => {
        if (env.NODE_ENV !== 'test') {
            return nodeFunction(state, config);
        }

        const nodeName = getNodeContext()?.name;
        if (!nodeName) {
            throw new Error('Node name not found');
        }

        // Check if we should interrupt BEFORE this node (because previous node set the flag)
        if (pendingInterruptAfterNode) {
            console.log('Interrupting', pendingInterruptAfterNode);
            const previousNode = pendingInterruptAfterNode;
            pendingInterruptAfterNode = null; // Clear the flag
            interrupt(previousNode);
        }

        const result = await nodeFunction(state, config);

        if (shouldInterrupt(nodeName)) {
            pendingInterruptAfterNode = nodeName;
        }

        return result;
    }
}

const shouldInterrupt = (nodeName: string) => {
    const interruptContext = getInterruptContext();
    console.log(`here is the interrupt context...`)
    console.log(interruptContext)
    if (!interruptContext) {
        return false;
    }
    return interruptContext.nodeName === nodeName;
}