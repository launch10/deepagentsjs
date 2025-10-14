import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { CoreGraphState } from "../state";

/**
 * Standard Langchain node function signature
 * All decorated methods must conform to this signature
 */
export type NodeFunction<TState extends CoreGraphState = CoreGraphState> = (
    state: TState,
    config?: LangGraphRunnableConfig
) => Promise<Partial<TState>>;

/**
 * Property descriptor that ensures the value is a NodeFunction
 */
export interface NodePropertyDescriptor<TState extends CoreGraphState = CoreGraphState> extends PropertyDescriptor {
    value?: NodeFunction<TState>;
}

/**
 * Decorator function that transforms a method into a NodeFunction
 */
export type NodeDecorator<TState extends CoreGraphState = CoreGraphState> = (
    target: any,
    propertyKey: string,
    descriptor?: PropertyDescriptor
) => NodePropertyDescriptor<TState>;

/**
 * Factory function that creates a NodeDecorator
 */
export type NodeDecoratorFactory<TOptions = any, TState extends CoreGraphState = CoreGraphState> = (
    options: TOptions
) => NodeDecorator<TState>;

/**
 * Base class for nodes that ensures all decorated methods are NodeFunctions
 */
export abstract class BaseNode<TState extends CoreGraphState = CoreGraphState> {
    // This ensures that any method decorated with our decorators
    // will have the correct signature
    [key: string]: any | NodeFunction<TState>;
}

/**
 * Type guard to check if a value is a NodeFunction
 */
export function isNodeFunction<TState extends CoreGraphState>(
    value: unknown
): value is NodeFunction<TState> {
    return typeof value === 'function' && value.length <= 2;
}

/**
 * Wraps a NodeFunction with additional behavior while maintaining the signature
 */
export function wrapNodeFunction<TState extends CoreGraphState>(
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