import { interrupt } from "@langchain/langgraph";

export interface InterruptOptions {
    /**
     * Whether to enable interrupt for this node in test mode
     * Defaults to true (all nodes are interruptible in tests)
     */
    enabled?: boolean;
    
    /**
     * The name to use for the interrupt point
     * Defaults to the node's class name or provided name
     */
    nodeName?: string;
    
    /**
     * Whether to interrupt before or after execution
     * Defaults to 'after' to capture state changes
     */
    when?: 'before' | 'after' | 'both';
}

/**
 * Custom error class for test interrupts
 */
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

/**
 * Decorator that adds test interrupt capabilities to a node
 * Interrupts occur AFTER the node executes to capture state changes
 */
export function withInterrupt(options: InterruptOptions = {}) {
    const { 
        enabled = true, 
        nodeName,
        when = 'after' 
    } = options;

    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args: any[]) {
            const [state, config] = args;
            const interruptName = nodeName || target.constructor.name || propertyKey;
            
            // Check if we should interrupt before execution
            if (enabled && shouldInterrupt(interruptName) && (when === 'before' || when === 'both')) {
                // Use LangGraph's native interrupt mechanism
                // This will throw a GraphInterrupt error
                interrupt({
                    node: interruptName,
                    state: state,
                    when: 'before'
                });
            }
            
            // Execute the original method
            const result = await originalMethod.apply(this, args);
            
            // Check if we should interrupt after execution
            if (enabled && shouldInterrupt(interruptName) && (when === 'after' || when === 'both')) {
                // Merge state with result to get full state at this point
                const updatedState = { ...state, ...result };
                
                // Use LangGraph's native interrupt mechanism
                // This will throw a GraphInterrupt error
                interrupt({
                    node: interruptName,
                    state: updatedState,
                    when: 'after'
                });
            }
            
            return result;
        };
        
        return descriptor;
    };
}

/**
 * Helper to check if a node should interrupt
 */
function shouldInterrupt(nodeName: string): boolean {
    return (
        process.env.NODE_ENV === 'test' &&
        process.env.TEST_INTERRUPT_NODE === nodeName
    );
}