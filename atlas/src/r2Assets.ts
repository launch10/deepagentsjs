import { Context } from 'hono';
import { Env } from './types';

export async function serveAssetFromR2(c: Context<{ Bindings: Env }>) {
  const url = new URL(c.req.url);
  // const tenantInfo = getTenantInfo(url.href);
  let pathname = url.pathname;
  
  // 1. Determine environment (production or preview)
  const isPreview = url.hostname.startsWith('preview.');
  const environment = isPreview ? 'preview' : 'production';

  // 2. Get the currently deployed version from KV
  const liveVersion = await c.env.DEPLOYS_KV.get(`live_version:${environment}:${tenantInfo.siteName}`);
  if (!liveVersion) {
    return new Response(`Site not configured: ${tenantInfo.siteName}`, { status: 404 });
  }

  // 3. Normalize path for index.html
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  } else if (!pathname.split('/').pop()?.includes('.')) {
    pathname += '/index.html';
  }
  // Remove leading slash
  pathname = pathname.substring(1);

  // 4. Construct the final R2 object key
  const objectKey = `${tenantInfo.userId}/${tenantInfo.orgId}/${environment}/${tenantInfo.siteName}/${liveVersion}/${pathname}`;

  // 5. Fetch from R2
  const object = await c.env.DEPLOYS_R2.get(objectKey);

  if (object === null) {
    return new Response(`Object Not Found: ${objectKey}`, { status: 404 });
  }

  // Set headers from R2 metadata
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag); // Important for browser caching

  return new Response(object.body, { headers });
}