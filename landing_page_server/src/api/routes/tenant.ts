import { Hono } from 'hono';
import { SDKClient } from '../../sdk/index.js';
import type { Env } from '../../types.js';
import type { TenantType } from '../../types.js';

export function tenantRoutes() {
  const router = new Hono<{ Bindings: Env }>();
  
  // GET /api/internal/tenants
  router.get('/', async (c) => {
    const limit = parseInt(c.req.query('limit') || '100');
    const client = new SDKClient(c);
    const result = await client.tenant.list(limit);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ tenants: result.data });
  });
  
  // GET /api/internal/tenants/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.tenant.get(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result.data);
  });
  
  // POST /api/internal/tenants
  router.post('/', async (c) => {
    try {
      const body = await c.req.json<TenantType>();
      
      if (!body.id || !body.orgId || !body.planId) {
        return c.json({ error: 'Missing required fields: id, orgId, planId' }, 400);
      }
      
      const client = new SDKClient(c);
      const result = await client.tenant.set(body.id, body);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id: body.id }, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // PUT /api/internal/tenants/:id
  router.put('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<Partial<TenantType>>();
      
      const client = new SDKClient(c);
      
      // Get existing tenant
      const existingResult = await client.tenant.get(id);
      if (!existingResult.success) {
        return c.json({ error: 'Tenant not found' }, 404);
      }
      
      // Merge with existing data
      const updatedData: TenantType = {
        ...existingResult.data!,
        ...body,
        id // Ensure ID doesn't change
      };
      
      const result = await client.tenant.set(id, updatedData);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // DELETE /api/internal/tenants/:id
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.tenant.delete(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, id });
  });
  
  return router;
}