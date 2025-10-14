import { type CoreGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { withInfrastructure, type InfrastructureOptions } from "./decorators";
import { Send } from "@langchain/langgraph";

/**
 * Base class for all nodes in the graph
 * Provides standardized structure with built-in infrastructure support
 * 
 * Key features:
 * - Clean execution interface (just implement execute())
 * - Automatic caching with sensible defaults
 * - Optional notifications
 * - Test interrupt support
 * - Works seamlessly with subgraphs
 * 
 * @example
 * class MyNode extends BaseNode {
 *   // Override infrastructure options as needed
 *   protected getInfrastructureOptions(): InfrastructureOptions {
 *     return {
 *       cache: { ttl: 600 }, // 10 minutes
 *       interrupt: { when: 'both' } // Interrupt before and after
 *     };
 *   }
 *   
 *   async execute(state, config) {
 *     // Your node logic here
 *     return { someUpdate: 'value' };
 *   }
 * }
 */
export abstract class BaseNode<TState> {
    /**
     * Main execution logic that must be implemented by all nodes
     * This is where the node's actual work happens
     * The @withInfrastructure decorator will be applied to this method
     */
    abstract execute(
        state: TState,
        config?: LangGraphRunnableConfig
    ): Promise<Partial<TState> | Send[]>;

    /**
     * Derive the node name from the class name
     * Removes "Node" suffix and converts to camelCase
     * e.g., "PlanComponentNode" → "planComponent"
     */
    protected getNodeName(): string {
        const className = this.constructor.name;
        // Remove "Node" suffix if present
        const nameWithoutNode = className.endsWith('Node') 
            ? className.slice(0, -4) 
            : className;
        // Convert first letter to lowercase for camelCase
        return nameWithoutNode.charAt(0).toLowerCase() + nameWithoutNode.slice(1);
    }

    /**
     * Override this to customize infrastructure options for your node
     * By default, provides sensible defaults based on the node's class name
     */
    protected config(): InfrastructureOptions {
        const nodeName = this.getNodeName();
        return {
            // Default options - can be overridden by child classes
            cache: {
                prefix: this.constructor.name,
                ttl: 60 * 60 * 24 * 7 // 7 days default
            },
            interrupt: {
                enabled: true,
                nodeName: nodeName,
                when: 'after'
            },
            polly: {
                enabled: true,
            }
        };
    }

    /**
     * Convert this class-based node to a function for use in LangGraph
     * This allows us to use class-based nodes with LangGraph's functional API
     * Applies the infrastructure decorator to the execute method
     */
    toNodeFunction(): (state: TState, config?: LangGraphRunnableConfig) => Promise<Partial<TState>> {
        // Get the infrastructure options
        const options = this.config();
        
        // Apply the decorator to the execute method
        const descriptor = Object.getOwnPropertyDescriptor(this, 'execute') || {
            value: this.execute,
            writable: true,
            enumerable: false,
            configurable: true
        };
        
        const decoratedDescriptor = withInfrastructure(options)(
            this,
            'execute',
            descriptor
        );
        
        // Return the decorated function bound to this instance
        return decoratedDescriptor.value.bind(this);
    }
}

/**
 * Helper to create a node function from a BaseNode class
 * This provides a clean way to instantiate and use class-based nodes
 * 
 * @example
 * const myNode = createNodeFunction(MyNodeClass);
 * graph.addNode("myNode", myNode);
 */
export function createNodeFunction<TNode extends BaseNode<TState>, TState extends CoreGraphState>(
    NodeClass: new () => TNode
): (state: TState, config?: LangGraphRunnableConfig) => Promise<Partial<TState>> {
    const instance = new NodeClass();
    return instance.toNodeFunction();
}