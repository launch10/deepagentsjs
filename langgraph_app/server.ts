import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { brainstormRoutes } from './app/server/routes/brainstorm';
import { errorHandler } from './app/server/middleware/errorHandler';
import { env } from './app/core/env';

const app = new Hono();

app.use('*', logger());
app.use('*', prettyJSON());

app.use('*', cors({
  origin: env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api/brainstorm', brainstormRoutes);

app.onError(errorHandler);

app.notFound((c) => c.json({ error: 'Not Found' }, 404));

const port = parseInt(process.env.PORT || '8080', 10);

export default {
  port,
  fetch: app.fetch,
};

console.log(`🚀 Hono server starting on http://localhost:${port}`);
