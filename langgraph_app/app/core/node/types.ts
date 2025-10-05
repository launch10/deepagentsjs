import type { LangGraphRunnableConfig } from "@langchain/langgraph";

/**
 * Base state type for all graph nodes
 */
export type GraphState = Record<string, unknown>;

/**
 * Standard Langchain node function signature
 * All decorated methods must conform to this signature
 */
export type NodeFunction<TState extends GraphState = GraphState> = (
    state: TState,
    config?: LangGraphRunnableConfig
) => Promise<Partial<TState>>;

/**
 * Property descriptor that ensures the value is a NodeFunction
 */
export interface NodePropertyDescriptor<TState extends GraphState = GraphState> extends PropertyDescriptor {
    value?: NodeFunction<TState>;
}

/**
 * Decorator function that transforms a method into a NodeFunction
 */
export type NodeDecorator<TState extends GraphState = GraphState> = (
    target: any,
    propertyKey: string,
    descriptor?: PropertyDescriptor
) => NodePropertyDescriptor<TState>;

/**
 * Factory function that creates a NodeDecorator
 */
export type NodeDecoratorFactory<TOptions = any, TState extends GraphState = GraphState> = (
    options: TOptions
) => NodeDecorator<TState>;

/**
 * Base class for nodes that ensures all decorated methods are NodeFunctions
 */
export abstract class BaseNode<TState extends GraphState = GraphState> {
    // This ensures that any method decorated with our decorators
    // will have the correct signature
    [key: string]: any | NodeFunction<TState>;
}

/**
 * Type guard to check if a value is a NodeFunction
 */
export function isNodeFunction<TState extends GraphState>(
    value: unknown
): value is NodeFunction<TState> {
    return typeof value === 'function' && value.length <= 2;
}

/**
 * Wraps a NodeFunction with additional behavior while maintaining the signature
 */
export function wrapNodeFunction<TState extends GraphState>(
    original: NodeFunction<TState>,
    wrapper: (
        original: NodeFunction<TState>,
        state: TState,
        config?: LangGraphRunnableConfig
    ) => Promise<Partial<TState>>
): NodeFunction<TState> {
    return async function wrappedNode(
        state: TState,
        config?: LangGraphRunnableConfig
    ): Promise<Partial<TState>> {
        return wrapper(original, state, config);
    };
}