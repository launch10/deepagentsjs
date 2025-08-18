import { Hono } from 'hono';
import { SDKClient } from '../../sdk/index.js';
import type { Env } from '../../types.js';
import type { PlanType } from '../../types.js';

export function planRoutes() {
  const router = new Hono<{ Bindings: Env }>();
  
  // GET /api/internal/plans
  router.get('/', async (c) => {
    const limit = parseInt(c.req.query('limit') || '100');
    const client = new SDKClient(c);
    const result = await client.plan.list(limit);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ plans: result.data });
  });
  
  // GET /api/internal/plans/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.plan.get(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result.data);
  });
  
  // POST /api/internal/plans
  router.post('/', async (c) => {
    try {
      const body = await c.req.json<PlanType>();
      
      if (!body.id || !body.name || body.usageLimit === undefined) {
        return c.json({ error: 'Missing required fields: id, name, usageLimit' }, 400);
      }
      
      const client = new SDKClient(c);
      const result = await client.plan.set(body.id, body);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id: body.id }, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // PUT /api/internal/plans/:id
  router.put('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<Partial<PlanType>>();
      
      const client = new SDKClient(c);
      
      // Get existing plan
      const existingResult = await client.plan.get(id);
      if (!existingResult.success) {
        return c.json({ error: 'Plan not found' }, 404);
      }
      
      // Merge with existing data
      const updatedData: PlanType = {
        ...existingResult.data!,
        ...body,
        id // Ensure ID doesn't change
      };
      
      const result = await client.plan.set(id, updatedData);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // DELETE /api/internal/plans/:id
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.plan.delete(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, id });
  });
  
  return router;
}