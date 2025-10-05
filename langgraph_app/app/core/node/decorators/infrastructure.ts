import { withCaching, type CacheOptions, keyFunc } from "./caching";
import { withNotifications, type NotificationOptions } from "./notifications";
import { withInterrupt, type InterruptOptions } from "./interrupt";
import { withErrorHandling } from "./errors";
import { withLogging } from "./logging";
import { withNodeContext } from "./nodeContext";
import { withPolly } from "./polly";
import { MiddlewareChain, type MethodDecorator } from "@utils";
export interface InfrastructureOptions {
    /**
     * Caching configuration for the node
     * If not provided, uses sensible defaults based on node name
     * Set to false to disable caching entirely
     */
    cache?: CacheOptions | false;
    
    /**
     * Notification configuration for the node
     */
    notifications?: NotificationOptions;
    
    /**
     * Interrupt configuration for testing
     * Defaults to enabled with 'after' timing
     */
    interrupt?: InterruptOptions;
    
    /**
     * Node name used for default configurations
     * Will be inferred from class name if not provided
     */
    nodeName?: string;
}

/**
 * Comprehensive infrastructure decorator that combines:
 * - Caching with sensible defaults
 * - Notifications
 * - Error handling
 * - Logging
 * - Node context
 * - Test interrupts
 * 
 * @example
 * class MyNode extends BaseNode {
 *   @withInfrastructure({
 *     cache: { ttl: 60 },  // Override cache TTL
 *     interrupt: { when: 'both' }  // Interrupt before and after
 *   })
 *   async execute(state, config) {
 *     // Node logic
 *   }
 * }
 */
export function withInfrastructure(options: InfrastructureOptions = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
        const nodeName = options.nodeName || target.constructor.name || propertyKey;
        
        // First in chain is applied first, then control is pass through each
        // subsequent layer
        const middlewareChain: MethodDecorator[] = [
            withInterrupt({
                enabled: true,
                nodeName: nodeName,
                when: 'after',
                ...options.interrupt
            }),
            withNodeContext({ name: nodeName }),
            withErrorHandling(),
            withPolly(),
            withLogging(),
            withNotifications(options.notifications || {}),
            withCaching({
                prefix: nodeName,
                keyFunc: keyFunc,
                ttl: 60 * 60 * 24,
                ...options.cache
            })
        ];

        return MiddlewareChain.decorate(middlewareChain, target, propertyKey, descriptor);
    };
}