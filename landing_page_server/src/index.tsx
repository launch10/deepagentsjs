import { Hono } from 'hono';
import { etag } from 'hono/etag';
import { Env } from './types';
import { loggerMiddleware, contextMiddleware, rateLimiterMiddleware } from './middleware';
import { logger } from '@utils/logger';

const app = new Hono<{ Bindings: Env }>();
const requestLogger = logger.addScope('request');

// Use Hono's built-in ETag middleware for automatic browser caching.
// This prevents the browser from re-downloading unchanged files.
// Note: We need to ensure content-type is preserved on 304 responses
app.use('*', contextMiddleware());
app.use('*', loggerMiddleware());
app.use('*', etag());
app.use('*', rateLimiterMiddleware);

// This is the main route that will catch all incoming requests.
app.get('*', async (c) => {
  // 1. Get the URL object to easily access hostname and pathname
  const url = new URL(c.req.url);
  const hostname = 'dist' //url.hostname;
  let pathname = url.pathname;

  // 2. Normalize the path to construct the R2 object key.
  //    - A request for the root "/" should serve "index.html".
  //    - A request for a clean URL "/about" should serve "/about/index.html".
  if (pathname.endsWith('/')) {
    pathname = pathname.concat('index.html');
  } else if (!pathname.split('/').pop()?.includes('.')) {
    pathname = pathname.concat('/index.html');
  }

  const objectKey = `${hostname}${pathname}`;

  // 3. Fetch the object from your R2 bucket.
  requestLogger.debug(`objectKey: ${objectKey}`);
  
  // Check if R2 binding exists
  if (!c.env.USER_PAGES) {
    return new Response('R2 bucket binding not available. Run with: npx wrangler dev --remote', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  const object = await c.env.USER_PAGES.get(objectKey);

  // 4. Handle the "Not Found" case.
  if (object === null) {
    // You could fetch a custom 404.html page from R2 here as well.
    // const notFoundKey = `${hostname}/404.html`;
    // const notFoundPage = await c.env.USER_PAGES.get(notFoundKey);
    // if (notFoundPage) return new Response(notFoundPage.body, { status: 404 });
    return new Response(`Object Not Found: ${objectKey}`, { status: 404 });
  }

  // 5. Build the response.
  //    - Create headers.
  //    - `object.writeHttpMetadata(headers)` copies essential metadata like
  //      Content-Type, Content-Language, etc., from R2 to the response.
  //    - `headers.set('etag', object.httpEtag)` provides the ETag for caching.
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  // Get content-type from R2 metadata or determine from file extension
  let contentType = headers.get('content-type') || object.httpMetadata?.contentType || '';
  
  // If no content-type, determine from file extension
  if (!contentType) {
    const ext = pathname.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'js': 'application/javascript',
      'mjs': 'application/javascript',
      'css': 'text/css',
      'html': 'text/html',
      'json': 'application/json',
      'svg': 'image/svg+xml',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'otf': 'font/otf',
    };
    
    contentType = (ext && contentTypes[ext]) || 'application/octet-stream';
  }
  
  // Always set the content-type header
  headers.set('content-type', contentType);
  
  console.log(`Serving ${objectKey} with content-type: ${contentType}`);

  // Return the response with the file's body and the correct headers.
  return new Response(object.body, {
    headers,
  });
});

import { RateLimiterDO } from './middleware/rateLimiter/rateLimiterDO';

export default app;
export { RateLimiterDO };