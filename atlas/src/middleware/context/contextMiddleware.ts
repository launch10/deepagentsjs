import { MiddlewareHandler } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { setRequestContext, clearRequestContext } from '@utils/als';
import { logger } from '@utils/logger';
import { Env } from '../../types';

/**
 * Hono middleware to establish a request context.
 * This should be placed BEFORE the requestLogger.
 */
export const contextMiddleware = (): MiddlewareHandler<{ Bindings: Env }> => async (c, next) => {
  logger.setConfig(c.env)

  const requestContext = {
    requestId: c.req.header('x-request-id') || uuidv4(),
    method: c.req.method,
    path: c.req.path,
  };
  
  setRequestContext(requestContext);
  
  try {
    await next();
  } finally {
    clearRequestContext();
  }
};