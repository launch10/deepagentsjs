import { MiddlewareHandler } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { setRequestContext, clearRequestContext } from '@utils/als';

/**
 * Hono middleware to establish a request context.
 * This should be placed BEFORE the requestLogger.
 */
export const contextMiddleware = (): MiddlewareHandler => async (c, next) => {
  const requestContext = {
    requestId: c.req.header('x-request-id') || uuidv4(),
    method: c.req.method,
    path: c.req.path,
  };
  
  // Set context for this request
  setRequestContext(requestContext);
  
  try {
    await next();
  } finally {
    // Clear context after request completes
    clearRequestContext();
  }
};