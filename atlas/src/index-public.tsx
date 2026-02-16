import { Hono } from 'hono';
import { etag } from 'hono/etag';
import { Env, CloudEnvironment, AppVariables } from './types';
import { loggerMiddleware, contextMiddleware } from './middleware';
import { Website } from '~/models/website';
import { WebsiteUrl } from '~/models/website-url';
import { WebsiteType } from './types';
import { logger } from '@utils/logger';
import { R2Bucket } from '@cloudflare/workers-types';

const ALLOWED_ENVS: CloudEnvironment[] = ['development', 'staging', 'production'];
const DEFAULT_ENV: CloudEnvironment = 'production';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();
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
  
  // Check query string for cloudEnv parameter
  const cloudEnvParam = url.searchParams.get('cloudEnv');
  
  // For asset requests, check the Referer header to inherit cloudEnv from the parent page
  let cloudEnv: CloudEnvironment = DEFAULT_ENV;
  if (cloudEnvParam && ALLOWED_ENVS.includes(cloudEnvParam as CloudEnvironment)) {
    cloudEnv = cloudEnvParam as CloudEnvironment;
  } else if (pathname.includes('/assets/') || pathname.endsWith('.js') || pathname.endsWith('.css')) {
    // Check referer header for cloudEnv parameter
    const referer = c.req.header('referer');
    if (referer) {
      const refererUrl = new URL(referer);
      const refererCloudEnv = refererUrl.searchParams.get('cloudEnv');
      if (refererCloudEnv && ALLOWED_ENVS.includes(refererCloudEnv as CloudEnvironment)) {
        cloudEnv = refererCloudEnv as CloudEnvironment;
      }
    }
  }
  
  // Set cloudEnv in context for models to access
  c.set('cloudEnv', cloudEnv);
  
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
    
    // Redirect to trailing slash for subpath websites to ensure relative paths resolve correctly
    // e.g., /bingo -> /bingo/ so that ./assets/app.js resolves to /bingo/assets/app.js
    if (urlMatch.matchedPath !== '/' && pathname === urlMatch.matchedPath) {
      const redirectUrl = new URL(c.req.url);
      redirectUrl.pathname = pathname + '/';
      return Response.redirect(redirectUrl.toString(), 301);
    }
    
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

  // SPA Fallback: Determine if this request should fallback to index.html on miss
  // Check BEFORE path normalization, since normalization adds /index.html
  const lastSegment = strippedPathname.split('/').pop() || '';
  const isAssetRequest = lastSegment.includes('.');      // /app.js, /logo.png
  const isDotfile = strippedPathname.includes('/.');     // /.well-known, /.htaccess
  const isApiRequest = strippedPathname.startsWith('/api/');
  const shouldFallbackOnMiss = !isAssetRequest && !isDotfile && !isApiRequest;

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
  
  // 4. Construct the object key.
  const objectKey = `${cloudEnv}/${website.id}/${targetDir}/${strippedPathname}`;
  console.log(`objectKey: ${objectKey}, environment: ${cloudEnv}`);
  requestLogger.debug(`objectKey: ${objectKey}, environment: ${cloudEnv}`);
  
  let r2Bucket: R2Bucket = c.env.DEPLOYS_R2;

  // 5. Fetch from R2
  let object = await r2Bucket.get(objectKey);

  // SPA fallback: serve index.html for route paths that don't exist
  if (object === null && shouldFallbackOnMiss) {
    const fallbackKey = `${cloudEnv}/${website.id}/${targetDir}/index.html`;
    object = await r2Bucket.get(fallbackKey);
  }

  // 6. Handle the "Not Found" case.
  if (object === null) {
    return new Response(`File not found`, { status: 404 });
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

  // Security headers
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

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