import { AsyncLocalStorage } from 'node:async_hooks';
import { getNodeContext } from './nodeContext';
import { startPolly, persistRecordings } from '@utils';

// This context simply tracks if a Polly session is already active for a given node name.
export interface PollyContext {
    recordingName: string;
}
const pollyContextStorage = new AsyncLocalStorage<PollyContext>();

/**
 * A decorator that wraps a method's execution in a Polly recording session.
 * It starts Polly before the method runs and guarantees recordings are persisted after,
 * even if the method throws an error.
 *
 * This should be one of the outer layers in your middleware chain.
 */
export function withPolly() {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
        const originalMethod = descriptor.value;

        descriptor.value = async function(...args: any[]) {
            // If we are not in test mode, do nothing. Zero overhead.
            if (process.env.NODE_ENV !== 'test') {
                return originalMethod.apply(this, args);
            }

            // Get the node name to use for the recording folder.
            const nodeCtx = getNodeContext();
            const recordingName = nodeCtx?.name || 'unknown-node-execution';
            
            // If a Polly session for this exact recording name is already active,
            // we are in a nested call. Just execute the method without starting a new session.
            if (pollyContextStorage.getStore()?.recordingName === recordingName) {
                return originalMethod.apply(this, args);
            }

            // This is the top-level call for this node, so start Polly.
            // `startPolly` should configure Polly to intercept global fetch/http requests.
            await startPolly(recordingName);

            try {
                // Run the original method within a context that marks this session as active.
                return await pollyContextStorage.run({ recordingName }, () => {
                    return originalMethod.apply(this, args);
                });
            } catch(error) { 
                throw error;
            } finally {
                // This `finally` block is the magic. It *always* runs after the `try` block,
                // ensuring that recordings are saved whether the node succeeded or failed.
                await persistRecordings();
            }
        };

        return descriptor;
    };
}