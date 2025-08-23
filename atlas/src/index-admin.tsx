import { Hono } from 'hono';
import { Env } from './types';
import { createInternalAPI } from './api/index';

const app = new Hono<{ Bindings: Env }>();

// Mount internal API routes
const internalAPI = createInternalAPI();
app.route('/api/internal', internalAPI);

// Redirect root to protected API - don't expose any information
app.get('/', (c) => {
  return c.json({ error: 'Unauthorized' }, 401);
});

// 404 for any other routes
app.all('*', (c) => {
  return c.json({ error: 'Not found' }, 404);
});

export default app;