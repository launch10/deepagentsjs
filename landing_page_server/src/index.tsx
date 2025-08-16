import { Hono } from 'hono';
import { etag } from 'hono/etag';
import { Env } from './types';
import { RateLimiter } from './durable-objects/rateLimiter';

const app = new Hono<{ Bindings: Env }>();

// Use Hono's built-in ETag middleware for automatic browser caching.
// This prevents the browser from re-downloading unchanged files.
app.use('*', etag());

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
  console.log(`objectKey: ${objectKey}`);
  console.log('env:', c.env);
  console.log('USER_PAGES binding:', c.env.USER_PAGES);
  
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

  // Return the response with the file's body and the correct headers.
  return new Response(object.body, {
    headers,
  });
});

export default app;
export { RateLimiter };