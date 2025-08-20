import { describe, it, expect, beforeEach } from 'vitest';
import { Context } from 'hono';
import { Request as RequestModel } from '~/models/request';
import { Env, RequestType } from '~/types';
import { Miniflare } from 'miniflare';
import { v4 as uuidv4 } from 'uuid';

describe('Request Model', () => {
  let mf: Miniflare;
  let env: Env;
  let ctx: Context<{ Bindings: Env }>;
  let requestModel: RequestModel;

  beforeEach(async () => {
    // Set up Miniflare environment
    mf = new Miniflare({
      modules: true,
      script: `export default { fetch: () => new Response() }`,
      kvNamespaces: ['DEPLOYS_KV'],
    });

    env = {
      DEPLOYS_KV: await mf.getKVNamespace('DEPLOYS_KV'),
    } as Env;

    // Mock Hono context
    ctx = {
      env,
      req: {
        url: 'http://test.example.com',
      },
    } as unknown as Context<{ Bindings: Env }>;

    requestModel = new RequestModel(ctx);

    // Clear KV store before each test
    const keys = await env.DEPLOYS_KV.list();
    for (const key of keys.keys) {
      await env.DEPLOYS_KV.delete(key.name);
    }
  });

  describe('findByTenantId', () => {
    it('should find request by tenant ID', async () => {
      const requestData: RequestType = {
        id: uuidv4(),
        tenantId: '1',
        count: 100,
      };

      await requestModel.set(requestData.id, requestData);
      const found = await requestModel.findByTenantId('1');

      expect(found).toEqual(requestData);
    });

    it('should handle numeric tenant IDs', async () => {
      const requestData: RequestType = {
        id: uuidv4(),
        tenantId: '1',
        count: 100,
      };

      await requestModel.set(requestData.id, requestData);

      // Should find with numeric ID
      const foundByNumber = await requestModel.findByTenantId(1 as any);
      expect(foundByNumber).toEqual(requestData);

      // Should find with string ID
      const foundByString = await requestModel.findByTenantId('1');
      expect(foundByString).toEqual(requestData);
    });

    it('should return null if not found', async () => {
      const found = await requestModel.findByTenantId('nonexistent');
      expect(found).toBeNull();
    });

    it('should prevent duplicate tenant IDs', async () => {
      const request1: RequestType = {
        id: uuidv4(),
        tenantId: '1',
        count: 100,
      };

      const request2: RequestType = {
        id: uuidv4(),
        tenantId: '1', // Same tenant ID
        count: 200,
      };

      await requestModel.set(request1.id, request1);
      
      // Should throw unique constraint violation
      await expect(
        requestModel.set(request2.id, request2)
      ).rejects.toThrow('Unique constraint violation');
    });

    it('should allow updating existing request', async () => {
      const requestData: RequestType = {
        id: uuidv4(),
        tenantId: '1',
        count: 100,
      };

      await requestModel.set(requestData.id, requestData);
      
      // Update count
      await requestModel.set(requestData.id, { count: 200 });

      const found = await requestModel.findByTenantId('1');
      expect(found?.count).toBe(200);
      expect(found?.id).toBe(requestData.id);
    });
  });

  describe('Real-world scenario: rate limiter update', () => {
    it('should handle rate limiter increments correctly', async () => {
      const tenantId = '1';
      
      // First request - should create new
      let existing = await requestModel.findByTenantId(tenantId);
      expect(existing).toBeNull();

      const newRequest: RequestType = {
        id: uuidv4(),
        tenantId,
        count: 0,
      };

      await requestModel.set(newRequest.id, newRequest);

      // Subsequent requests - should update existing
      for (let i = 1; i <= 10; i++) {
        existing = await requestModel.findByTenantId(tenantId);
        expect(existing).not.toBeNull();
        
        await requestModel.set(existing!.id, { count: existing!.count + 10 });
        
        const updated = await requestModel.findByTenantId(tenantId);
        expect(updated?.count).toBe(i * 10);
        expect(updated?.id).toBe(newRequest.id); // ID should not change
      }
    });

    it('should not create duplicate requests for same tenant', async () => {
      const tenantId = '1';
      
      // Simulate what happens in rateLimiterMiddleware
      const request1 = await requestModel.findByTenantId(tenantId);
      
      if (!request1) {
        const newRequest: RequestType = {
          id: uuidv4(),
          tenantId: String(tenantId),
          count: 10,
        };
        await requestModel.set(newRequest.id, newRequest);
      }

      // Simulate another request coming in
      const request2 = await requestModel.findByTenantId(tenantId);
      expect(request2).not.toBeNull();

      // Try to create another request with same tenant ID (simulating race condition)
      const duplicateRequest: RequestType = {
        id: uuidv4(),
        tenantId: String(tenantId),
        count: 20,
      };

      await expect(
        requestModel.set(duplicateRequest.id, duplicateRequest)
      ).rejects.toThrow('Unique constraint violation');

      // Verify only one request exists
      const finalRequest = await requestModel.findByTenantId(tenantId);
      expect(finalRequest?.count).toBe(10); // Original count unchanged
    });
  });

  describe('KV storage verification', () => {
    it('should store correct keys in KV', async () => {
      const requestData: RequestType = {
        id: 'request-123',
        tenantId: '1',
        count: 100,
      };

      await requestModel.set(requestData.id, requestData);

      // Check main record
      const mainKey = 'request:request-123';
      const mainValue = await env.DEPLOYS_KV.get(mainKey);
      expect(JSON.parse(mainValue!)).toEqual(requestData);

      // Check unique index
      const indexKey = 'index:request:tenantId:1';
      const indexValue = await env.DEPLOYS_KV.get(indexKey);
      expect(indexValue).toBe('request-123');
    });

    it('should not create orphaned records', async () => {
      const request1: RequestType = {
        id: 'request-1',
        tenantId: '1',
        count: 100,
      };

      await requestModel.set(request1.id, request1);

      // List all keys
      const keysBefore = await env.DEPLOYS_KV.list();
      expect(keysBefore.keys).toHaveLength(2); // Main record + index

      // Try to create duplicate (should fail)
      const request2: RequestType = {
        id: 'request-2',
        tenantId: '1',
        count: 200,
      };

      try {
        await requestModel.set(request2.id, request2);
      } catch (e) {
        // Expected to fail
      }

      // Verify no orphaned records
      const keysAfter = await env.DEPLOYS_KV.list();
      expect(keysAfter.keys).toHaveLength(2); // Should still be 2

      // Verify index still points to original
      const found = await requestModel.findByTenantId('1');
      expect(found?.id).toBe('request-1');
    });
  });
});