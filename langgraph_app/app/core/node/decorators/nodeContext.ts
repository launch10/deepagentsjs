import { AsyncLocalStorage } from 'node:async_hooks';
export interface NodeContext {
    name: string;
}

const nodeContext = new AsyncLocalStorage<NodeContext>();

export function getNodeContext(): NodeContext | undefined {
    return nodeContext.getStore();
}

export function withNodeContext({ name }: NodeContext) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args: any[]) {
            // Derive recording name from class name
            const className = name || target.constructor.name;
            
            // Remove common suffixes (Node, Service, etc.)
            let baseName = className;
            if (baseName.endsWith('Node')) {
                baseName = baseName.slice(0, -4);
            } else if (baseName.endsWith('Service')) {
                baseName = baseName.slice(0, -7);
            }
            
            const cleanName = baseName
                .replace(/([A-Z])/g, '-$1')
                .toLowerCase()
                .slice(1); // Remove leading dash
                
            const currentContext = nodeContext.getStore();
            
            // If we're already within the same recording context, just execute
            // This prevents double wrapping when a node calls a service or another node
            if (currentContext && currentContext.name === cleanName) {
                return await originalMethod.apply(this, args);
            }

            const newContext: NodeContext = {
                name: cleanName,
            };

            return await nodeContext.run(newContext, async () => {
                return await originalMethod.apply(this, args);
            });
        };
        return descriptor;
    };
}