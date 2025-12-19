import { Hono } from 'hono';
import { SDKClient } from '../../sdk/index.js';
import type { Env } from '../../types.js';
import type { WebsiteUrlType } from '../../types.js';

export function websiteUrlRoutes() {
  const router = new Hono<{ Bindings: Env }>();
  
  // GET /api/internal/website-urls
  router.get('/', async (c) => {
    const limit = parseInt(c.req.query('limit') || '100');
    const websiteId = c.req.query('websiteId');
    const id = c.req.query('id');
    
    const client = new SDKClient(c);
    
    if (id) {
      const result = await client.websiteUrl.get(id);
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      return c.json({ websiteUrls: [result.data] });
    }
    
    if (websiteId) {
      const result = await client.websiteUrl.findByWebsiteId(websiteId);
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      return c.json({ websiteUrls: result.data ? [result.data] : [] });
    }
    
    const result = await client.websiteUrl.list(limit);
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ websiteUrls: result.data });
  });
  
  // GET /api/internal/website-urls/by-domain-path
  router.get('/by-domain-path', async (c) => {
    const domain = c.req.query('domain');
    const path = c.req.query('path') || '/';
    
    if (!domain) {
      return c.json({ error: 'domain parameter is required' }, 400);
    }
    
    const client = new SDKClient(c);
    const result = await client.websiteUrl.findByDomainAndPath(domain, path);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result.data);
  });
  
  // GET /api/internal/website-urls/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.websiteUrl.get(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result.data);
  });
  
  // POST /api/internal/website-urls
  router.post('/', async (c) => {
    try {
      const body = await c.req.json<WebsiteUrlType>();
      
      const websiteUrlData: WebsiteUrlType = {
        id: body.id || String(body.id),
        domain: body.domain,
        path: body.path || '/',
        websiteId: (body as any).websiteId || (body as any).website_id,
        domainId: (body as any).domainId || (body as any).domain_id
      };
      
      if (!websiteUrlData.domain || !websiteUrlData.websiteId) {
        return c.json({ error: 'Missing required fields: domain, websiteId' }, 400);
      }
      
      if (!websiteUrlData.id) {
        websiteUrlData.id = crypto.randomUUID();
      }
      
      const client = new SDKClient(c);
      const result = await client.websiteUrl.set(websiteUrlData.id, websiteUrlData);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id: websiteUrlData.id }, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // PUT /api/internal/website-urls/:id
  router.put('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<Partial<WebsiteUrlType>>();
      
      const client = new SDKClient(c);
      
      const existingResult = await client.websiteUrl.get(id);
      if (!existingResult.success) {
        return c.json({ error: 'WebsiteUrl not found' }, 404);
      }
      
      const updatedData: WebsiteUrlType = {
        ...existingResult.data!,
        id,
        domain: body.domain || existingResult.data!.domain,
        path: body.path || existingResult.data!.path,
        websiteId: (body as any).websiteId || (body as any).website_id || existingResult.data!.websiteId,
        domainId: (body as any).domainId || (body as any).domain_id || existingResult.data!.domainId
      };
      
      const result = await client.websiteUrl.set(id, updatedData);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // DELETE /api/internal/website-urls/:id
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.websiteUrl.delete(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, id });
  });
  
  return router;
}
