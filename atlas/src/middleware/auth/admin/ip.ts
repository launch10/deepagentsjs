
import type { Env } from '~/types';
import type { Context, Next } from 'hono';

export const ipAllowlistMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
    // Skip IP check for health endpoint
    if (c.req.path === '/health' || c.req.path === '/api/internal/health') {
      return next();
    }

    const clientIP = c.req.header('CF-Connecting-IP') || 
                     c.req.header('X-Real-IP') ||
                     c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
                     'unknown';

    const allowedIPs = [
      '127.0.0.1',
      '::1',
      'localhost',
      ...(c.env.ALLOWED_IPS?.split(',') || [])
    ];

    if (!allowedIPs.includes(clientIP)) {
      console.warn(`Blocked request from unauthorized IP: ${clientIP}`);
      return c.json({ error: 'Unauthorized' }, 403);
    }

    return next();
};