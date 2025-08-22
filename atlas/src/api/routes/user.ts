import { Hono } from 'hono';
import { SDKClient } from '../../sdk/index.js';
import type { Env } from '../../types.js';
import type { UserType } from '../../types.js';

export function userRoutes() {
  const router = new Hono<{ Bindings: Env }>();
  
  // GET /api/internal/users
  router.get('/', async (c) => {
    const limit = parseInt(c.req.query('limit') || '100');
    const client = new SDKClient(c);
    const result = await client.user.list(limit);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ users: result.data });
  });
  
  // GET /api/internal/users/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.user.get(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result.data);
  });
  
  // POST /api/internal/users
  router.post('/', async (c) => {
    try {
      const body = await c.req.json<UserType>();
      
      if (!body.id) {
        return c.json({ error: 'Missing required fields: id, planId' }, 400);
      }
      
      const client = new SDKClient(c);
      const result = await client.user.set(body.id, body);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id: body.id }, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // PUT /api/internal/users/:id
  router.put('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<Partial<UserType>>();
      
      const client = new SDKClient(c);
      
      // Get existing user
      const existingResult = await client.user.get(id);
      if (!existingResult.success) {
        return c.json({ error: 'User not found' }, 404);
      }
      
      // Merge with existing data
      const updatedData: UserType = {
        ...existingResult.data!,
        ...body,
        id // Ensure ID doesn't change
      };
      
      const result = await client.user.set(id, updatedData);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // DELETE /api/internal/users/:id
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.user.delete(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, id });
  });
  
  // POST /api/internal/users/:id/block
  router.post('/:id/block', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.user.block(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, message: `User ${id} blocked successfully` });
  });
  
  // POST /api/internal/users/:id/unblock
  router.post('/:id/unblock', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.user.unblock(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, message: `User ${id} unblocked successfully` });
  });
  
  // POST /api/internal/users/:id/reset
  router.post('/:id/reset', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.user.reset(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, message: `User ${id} reset successfully` });
  });
  
  // GET /api/internal/users/:id/status
  router.get('/:id/status', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.user.status(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ 
      success: true, 
      status: result.data,
      userId: id 
    });
  });
  
  return router;
}