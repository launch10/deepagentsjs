import { Hono } from 'hono';
import { SDKClient } from '../../sdk/index.js';
import type { Env } from '../../types.js';
import type { AccountType } from '../../types.js';

export function accountRoutes() {
  const router = new Hono<{ Bindings: Env }>();
  
  // GET /api/internal/accounts
  router.get('/', async (c) => {
    const limit = parseInt(c.req.query('limit') || '100');
    const client = new SDKClient(c);
    const result = await client.account.list(limit);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ accounts: result.data });
  });
  
  // GET /api/internal/accounts/:id
  router.get('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.account.get(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, result.error?.includes('not found') ? 404 : 500);
    }
    
    return c.json(result.data);
  });
  
  // POST /api/internal/accounts
  router.post('/', async (c) => {
    try {
      const body = await c.req.json<AccountType>();
      
      if (!body.id) {
        return c.json({ error: 'Missing required fields: id, planId' }, 400);
      }
      
      const client = new SDKClient(c);
      const result = await client.account.set(body.id, body);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id: body.id }, 201);
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // PUT /api/internal/accounts/:id
  router.put('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<Partial<AccountType>>();
      
      const client = new SDKClient(c);
      
      // Get existing account
      const existingResult = await client.account.get(id);
      if (!existingResult.success) {
        return c.json({ error: 'Account not found' }, 404);
      }
      
      // Merge with existing data
      const updatedData: AccountType = {
        ...existingResult.data!,
        ...body,
        id // Ensure ID doesn't change
      };
      
      const result = await client.account.set(id, updatedData);
      
      if (!result.success) {
        return c.json({ error: result.error }, 500);
      }
      
      return c.json({ success: true, id });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
  
  // DELETE /api/internal/accounts/:id
  router.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.account.delete(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, id });
  });
  
  // POST /api/internal/accounts/:id/block
  router.post('/:id/block', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.account.block(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, message: `Account ${id} blocked successfully` });
  });
  
  // POST /api/internal/accounts/:id/unblock
  router.post('/:id/unblock', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.account.unblock(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, message: `Account ${id} unblocked successfully` });
  });
  
  // POST /api/internal/accounts/:id/reset
  router.post('/:id/reset', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.account.reset(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ success: true, message: `Account ${id} reset successfully` });
  });
  
  // GET /api/internal/accounts/:id/status
  router.get('/:id/status', async (c) => {
    const id = c.req.param('id');
    const client = new SDKClient(c);
    const result = await client.account.status(id);
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ 
      success: true, 
      status: result.data,
      accountId: id 
    });
  });
  
  return router;
}