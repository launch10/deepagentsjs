import { Hono } from 'hono';
import { Env } from './types';
import { createInternalAPI } from './api/index';

const app = new Hono<{ Bindings: Env }>();

// ADMIN WORKER - Only for internal APIs, not publicly accessible

// IP Allowlist middleware - only allow requests from known sources
app.use('*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
  const allowedIPs = (c.env.ALLOWED_IPS || '').split(',').filter(Boolean);
  
  // In development, allow all IPs
  if (c.env.NODE_ENV === 'development' || allowedIPs.length === 0) {
    return next();
  }
  
  // In production, enforce IP allowlist
  if (!ip || !allowedIPs.includes(ip)) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  
  return next();
});

// Mount internal API routes
const internalAPI = createInternalAPI();
app.route('/api/internal', internalAPI);

// Health check at root
app.get('/', (c) => {
  return c.json({ 
    status: 'healthy',
    service: 'landing-page-server-admin',
    timestamp: new Date().toISOString()
  });
});

// 404 for any other routes
app.all('*', (c) => {
  return c.json({ error: 'Not found' }, 404);
});

export default app;