import { AsyncLocalStorage } from 'node:async_hooks';
import { interrupt } from "@langchain/langgraph";
import { env } from "@core";
import type { NodeFunction, MinimalStateType } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getNodeContext } from "./withContext";

export interface InterruptContext {
    nodeName: string;
    isInterrupted: boolean;
}

export const interruptContext = new AsyncLocalStorage<InterruptContext>();
export const getInterruptContext = () => interruptContext.getStore();

type WithInterruptConfig = Record<string, never>;

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
        if (isInterrupted()) {
            const context = getInterruptContext();
            if (!context) {
                throw new Error('Interrupt context not found');
            }
            context.isInterrupted = false;
            interrupt(context.nodeName);
        }

        const result = await nodeFunction(state, config);

        if (shouldInterrupt(nodeName)) {
            const context = getInterruptContext();
            if (!context) {
                throw new Error('Interrupt context not found');
            }
            context.isInterrupted = true;
        }

        return result;
    }
}

const isInterrupted = () => {
    const interruptContext = getInterruptContext();
    if (!interruptContext) {
        return false;
    }
    return interruptContext.isInterrupted;
}

const shouldInterrupt = (nodeName: string) => {
    const interruptContext = getInterruptContext();
    if (!interruptContext) {
        return false;
    }
    return interruptContext.nodeName === nodeName;
}