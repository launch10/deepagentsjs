/**
 * Decorator that adds error handling to a node
 */
export function withLogging() {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args: any[]) {
            console.log("Executing node: ", this.constructor.name);
            return await originalMethod.apply(this, args);
        };
        
        return descriptor;
    };
}