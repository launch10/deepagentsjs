import { rollbar } from "@core";

/**
 * Decorator that adds error handling to a node
 */
export function withErrorHandling() {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args: any[]) {
            try {
              const [state, config] = args;
              if (state.error) {
                console.log(`Skipping ${this.constructor.name} due to existing error from ${state.error.node}`)
                return {}; // Return empty object to preserve existing error
              }
              return await originalMethod.apply(this, args);
            } catch (error) {
              console.log(`Error in ${this.constructor.name}: ${error.message}`);
              const [state] = args;
              // If there's already an error in state, don't overwrite it
              if (state.error) {
                console.log(`${this.constructor.name} failed but preserving existing error from ${state.error.node}`);
                return {}; // Return empty object to preserve existing error
              }
              
              rollbar.error(error);
              const errorInfo = { 
                message: error.message, 
                node: this.constructor.name, 
                stack: error.stack, 
                pregelTaskId: error.pregelTaskId 
              };
              console.log(`Error in ${this.constructor.name}: ${error.message}`);
              return { error: errorInfo }
            }
        };
        
        return descriptor;
    };
}