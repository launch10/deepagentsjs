import { Hono } from 'hono';
import { Env } from './types';
import { createInternalAPI } from './api/index';

const app = new Hono<{ Bindings: Env }>();

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