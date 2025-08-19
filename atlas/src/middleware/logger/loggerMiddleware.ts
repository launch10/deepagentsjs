import { MiddlewareHandler } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { mainLogger as logger } from '@utils/logger';

/**
 * Hono middleware to bridge its simple logger with our powerful Winston logger.
 */
export const loggerMiddleware = (): MiddlewareHandler =>
  honoLogger((message) => {
    logger.http(message);
  });