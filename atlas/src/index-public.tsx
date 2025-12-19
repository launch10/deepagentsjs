import { Hono } from 'hono';
import { etag } from 'hono/etag';
import { Env } from './types';
import { loggerMiddleware, contextMiddleware } from './middleware';
import { Website } from '~/models/website';
import { WebsiteUrl } from '~/models/website-url';
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

  // Try WebsiteUrl first (new path-based routing), fall back to legacy Domain lookup
  const websiteUrlModel = new WebsiteUrl(c);
  const websiteModel = new Website(c);
  
  let website: WebsiteType | null = null;
  let matchedPath = '/';
  
  // Try to find WebsiteUrl with longest path match
  const urlMatch = await websiteUrlModel.findByDomainWithLongestPathMatch(lookupHostname, pathname);
  
  if (urlMatch) {
    console.log(`Found WebsiteUrl for hostname: ${lookupHostname}, path: ${urlMatch.matchedPath}`);
    website = await websiteModel.get(urlMatch.websiteUrl.websiteId);
    matchedPath = urlMatch.matchedPath;
  } else {
    // Fall back to legacy Domain-based lookup via Website.findByUrl
    console.log(`No WebsiteUrl found, falling back to legacy lookup for hostname: ${lookupHostname}`);
    website = await websiteModel.findByUrl(lookupHostname);
  }

  if (!website) {
    return new Response('Website not found', { status: 404 });
  }

  // Strip matched path prefix from pathname for R2 lookup
  let strippedPathname = pathname;
  if (matchedPath !== '/') {
    strippedPathname = pathname.slice(matchedPath.length) || '/';
  }

  // 2. Normalize the path to construct the R2 object key.
  if (strippedPathname.endsWith('/')) {
    strippedPathname = strippedPathname.concat('index.html');
  } else if (!strippedPathname.split('/').pop()?.includes('.')) {
    strippedPathname = strippedPathname.concat('/index.html');
  }

  if (strippedPathname.startsWith('/')) {
    strippedPathname = strippedPathname.substring(1);
  }

  // 3. Determine the target directory and environment
  const targetDir = isPreview ? 'preview' : 'live';
  const envBucket = env ? env : 'production';
  
  // 4. Construct the object key.
  const objectKey = `${envBucket}/${website.id}/${targetDir}/${strippedPathname}`;
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
    const ext = strippedPathname.split('.').pop()?.toLowerCase();
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