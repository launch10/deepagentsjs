import { Hono } from 'hono';
import { etag } from 'hono/etag';
import { Env } from './types';
import { loggerMiddleware, contextMiddleware } from './middleware';
import { Website } from '~/models/website';
import { WebsiteType } from './types';
import { logger } from '@utils/logger';
import { R2Bucket } from '@cloudflare/workers-types';

const app = new Hono<{ Bindings: Env }>();
const requestLogger = logger.addScope('request');

// Use Hono's built-in ETag middleware for automatic browser caching.
app.use('*', contextMiddleware());
app.use('*', loggerMiddleware());
app.use('*', etag());

// This is the main route that will catch all incoming requests.
app.get('*', async (c) => {
  // 1. Get the URL object to easily access hostname and pathname
  const url = new URL(c.req.url);
  const hostname = url.hostname;
  let pathname = url.pathname;

  const isPreview = hostname.startsWith('preview.');
  const allowedEnvs = ['development', 'staging', 'production'];
  
  // Check query string for cloudEnv parameter
  const cloudEnv = url.searchParams.get('cloudEnv');
  
  // For asset requests, check the Referer header to inherit cloudEnv from the parent page
  let env: string | undefined;
  if (cloudEnv && allowedEnvs.includes(cloudEnv)) {
    env = cloudEnv;
  } else if (pathname.includes('/assets/') || pathname.endsWith('.js') || pathname.endsWith('.css')) {
    // Check referer header for cloudEnv parameter
    const referer = c.req.header('referer');
    if (referer) {
      const refererUrl = new URL(referer);
      const refererCloudEnv = refererUrl.searchParams.get('cloudEnv');
      if (refererCloudEnv && allowedEnvs.includes(refererCloudEnv)) {
        env = refererCloudEnv;
      }
    }
  }
  
  // Remove preview prefix to get the actual domain for lookup
  let lookupHostname = hostname;
  if (isPreview) {
    lookupHostname = hostname.replace('preview.', '');
  }

  const websiteModel = new Website(c); 
  console.log(`Looking up website for hostname: ${lookupHostname}`);
  const website: WebsiteType | null = await websiteModel.findByUrl(lookupHostname);

  if (!website) {
    return new Response('Website not found', { status: 404 });
  }

  // 2. Normalize the path to construct the R2 object key.
  if (pathname.endsWith('/')) {
    pathname = pathname.concat('index.html');
  } else if (!pathname.split('/').pop()?.includes('.')) {
    pathname = pathname.concat('/index.html');
  }

  if (pathname.startsWith('/')) {
    pathname = pathname.substring(1);
  }

  // 3. Determine the target directory and environment
  const targetDir = isPreview ? 'preview' : 'live';
  const envBucket = env ? env : 'production';
  
  // 4. Construct the object key.
  const objectKey = `${envBucket}/${website.id}/${targetDir}/${pathname}`;
  console.log(`objectKey: ${objectKey}, environment: ${envBucket}`);
  requestLogger.debug(`objectKey: ${objectKey}, environment: ${envBucket}`);
  
  let r2Bucket: R2Bucket = c.env.DEPLOYS_R2;
  
  // 5. Fetch from R2
  const object = await r2Bucket.get(objectKey);

  // 6. Handle the "Not Found" case.
  if (object === null) {
    return new Response(`Website not found, error 505`, { status: 404 });
  }

  // 7. Build the response.
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  // Get content-type from R2 metadata or determine from file extension
  let contentType = headers.get('content-type') || object.httpMetadata?.contentType || '';
  
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
  
  headers.set('content-type', contentType);
  
  console.log(`Serving ${objectKey} with content-type: ${contentType}`);

  return new Response(object.body, {
    headers,
  });
});

// Stub class for migration - will be deleted
export class FirewallDO {
  constructor(state: any, env: Env) {}
  async fetch(request: Request): Promise<Response> {
    return new Response('Stub DO - to be deleted', { status: 501 });
  }
}

export default app;