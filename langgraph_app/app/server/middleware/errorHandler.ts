import type { ErrorHandler } from 'hono';
import { env } from '@core';

export const errorHandler: ErrorHandler = (err, c) => {
  console.error('Server Error:', err);

  const isDev = env.NODE_ENV === 'development';
  
  return c.json({
    error: err.message || 'Internal Server Error',
    ...(isDev && { stack: err.stack }),
  }, 500);
};
