import { describe, it, expect, beforeEach } from 'vitest';
import { Context } from 'hono';
import { Env, RequestType, FirewallType } from '~/types';
import { Request as RequestModel } from '~/models/request';
import { Firewall } from '~/models/firewall';
import { Miniflare } from 'miniflare';
import { v4 as uuidv4 } from 'uuid';

describe('KV Unique Constraint Integration Tests', () => {
  let mf: Miniflare;
  let env: Env;
  let ctx: Context<{ Bindings: Env }>;

  beforeEach(async () => {
    // Set up real Miniflare KV environment
    mf = new Miniflare({
      modules: true,
      script: `export default { fetch: () => new Response() }`,
      kvNamespaces: ['DEPLOYS_KV'],
    });

    const kv = await mf.getKVNamespace('DEPLOYS_KV');
    
    env = {
      DEPLOYS_KV: kv,
    } as Env;

    ctx = {
      env,
      req: {
        url: 'http://test.example.com',
      },
    } as unknown as Context<{ Bindings: Env }>;

    // Clear KV store
    const keys = await kv.list();
    for (const key of keys.keys) {
      await kv.delete(key.name);
    }
  });

  describe('Duplicate Prevention', () => {
    it('should prevent creating duplicate Request records for same user', async () => {
      const requestModel = new RequestModel(ctx);
      
      // Create first request
      const request1: RequestType = {
        id: uuidv4(),
        userId: '1',
        count: 100,
      };
      
      await requestModel.set(request1.id, request1);
      
      // Verify it was created
      const found1 = await requestModel.findByUserId('1');
      expect(found1).toEqual(request1);
      
      // Try to create second request with same userId
      const request2: RequestType = {
        id: uuidv4(),
        userId: '1', // Same user ID
        count: 200,
      };
      
      // Should throw unique constraint violation
      await expect(
        requestModel.set(request2.id, request2)
      ).rejects.toThrow('Unique constraint violation');
      
      // Verify only first request exists
      const foundAfter = await requestModel.findByUserId('1');
      expect(foundAfter?.id).toBe(request1.id);
      expect(foundAfter?.count).toBe(100);
      
      // Verify KV storage state
      const keys = await env.DEPLOYS_KV.list();
      const requestKeys = keys.keys.filter(k => k.name.startsWith('request:'));
      expect(requestKeys).toHaveLength(1); // Only one request record
      
      const indexKeys = keys.keys.filter(k => k.name.startsWith('index:request:'));
      expect(indexKeys).toHaveLength(1); // Only one index
    });

    it('should prevent creating duplicate Firewall records for same user', async () => {
      const firewallModel = new Firewall(ctx);
      
      // Create first firewall
      const firewall1: FirewallType = {
        id: uuidv4(),
        userId: '1',
        status: 'blocked',
      };
      
      await firewallModel.set(firewall1.id, firewall1);
      
      // Verify it was created
      const found1 = await firewallModel.findByUser('1');
      expect(found1).toEqual(firewall1);
      
      // Try to create second firewall with same userId
      const firewall2: FirewallType = {
        id: uuidv4(),
        userId: '1', // Same user ID
        status: 'inactive',
      };
      
      // Should throw unique constraint violation
      await expect(
        firewallModel.set(firewall2.id, firewall2)
      ).rejects.toThrow('Unique constraint violation');
      
      // Verify only first firewall exists
      const foundAfter = await firewallModel.findByUser('1');
      expect(foundAfter?.id).toBe(firewall1.id);
      expect(foundAfter?.status).toBe('blocked');
      
      // Verify KV storage state
      const keys = await env.DEPLOYS_KV.list();
      const firewallKeys = keys.keys.filter(k => k.name.startsWith('firewall:'));
      expect(firewallKeys).toHaveLength(1); // Only one firewall record
    });
  });

  describe('Orphaned Record Prevention', () => {
    it('should not create orphaned records when unique constraint fails', async () => {
      const requestModel = new RequestModel(ctx);
      
      // Create first request
      const request1: RequestType = {
        id: 'request-1',
        userId: '1',
        count: 100,
      };
      
      await requestModel.set(request1.id, request1);
      
      // Get initial KV state
      const keysBefore = await env.DEPLOYS_KV.list();
      const recordsBefore = keysBefore.keys.length;
      
      // Try to create duplicate (should fail)
      const request2: RequestType = {
        id: 'request-2',
        userId: '1',
        count: 200,
      };
      
      try {
        await requestModel.set(request2.id, request2);
      } catch (e) {
        // Expected to fail
      }
      
      // Verify no new records were created
      const keysAfter = await env.DEPLOYS_KV.list();
      expect(keysAfter.keys.length).toBe(recordsBefore);
      
      // Verify request-2 was not stored
      const request2Data = await env.DEPLOYS_KV.get('request:request-2');
      expect(request2Data).toBeNull();
      
      // Verify index still points to original
      const indexValue = await env.DEPLOYS_KV.get('index:request:userId:1');
      expect(indexValue).toBe('request-1');
    });
  });

  describe('Real-world Scenario Simulation', () => {
    it('should handle the exact middleware flow without duplicates', async () => {
      const requestModel = new RequestModel(ctx);
      const firewallModel = new Firewall(ctx);
      
      const userId = '1';
      
      // Simulate first batch of requests
      let request = await requestModel.findByUserId(userId);
      expect(request).toBeNull();
      
      // Create initial request
      const newRequestId = uuidv4();
      await requestModel.set(newRequestId, {
        id: newRequestId,
        userId: String(userId),
        count: 10,
      });
      
      // Simulate second batch
      request = await requestModel.findByUserId(userId);
      expect(request).not.toBeNull();
      expect(request?.count).toBe(10);
      
      // Update count
      await requestModel.set(request!.id, { ...request!, count: 20 });
      
      // Simulate threshold crossing - create firewall
      let firewall = await firewallModel.findByUser(userId);
      expect(firewall).toBeNull();
      
      const newFirewallId = uuidv4();
      await firewallModel.set(newFirewallId, {
        id: newFirewallId,
        userId: String(userId),
        status: 'monitoring',
      });
      
      // Simulate concurrent request trying to create duplicate firewall
      firewall = await firewallModel.findByUser(userId);
      expect(firewall).not.toBeNull();
      expect(firewall?.status).toBe('monitoring');
      
      // Try to create another firewall (should fail)
      const duplicateFirewallId = uuidv4();
      await expect(
        firewallModel.set(duplicateFirewallId, {
          id: duplicateFirewallId,
          userId: String(userId),
          status: 'monitoring',
        })
      ).rejects.toThrow('Unique constraint violation');
      
      // Verify final state
      const finalRequest = await requestModel.findByUserId(userId);
      const finalFirewall = await firewallModel.findByUser(userId);
      
      expect(finalRequest?.id).toBe(newRequestId);
      expect(finalRequest?.count).toBe(20);
      expect(finalFirewall?.id).toBe(newFirewallId);
      
      // Verify no duplicates in KV
      const keys = await env.DEPLOYS_KV.list();
      const requestRecords = keys.keys.filter(k => k.name.startsWith('request:'));
      const firewallRecords = keys.keys.filter(k => k.name.startsWith('firewall:'));
      
      expect(requestRecords).toHaveLength(1);
      expect(firewallRecords).toHaveLength(1);
    });

    it('should handle numeric vs string user IDs consistently', async () => {
      const requestModel = new RequestModel(ctx);
      
      // Create with string user ID
      const request1: RequestType = {
        id: 'request-1',
        userId: '123',
        count: 100,
      };
      
      await requestModel.set(request1.id, request1);
      
      // Find with numeric ID (coerced to string)
      const foundByNumber = await requestModel.findByUserId(123 as any);
      expect(foundByNumber).toEqual(request1);
      
      // Find with string ID
      const foundByString = await requestModel.findByUserId('123');
      expect(foundByString).toEqual(request1);
      
      // Try to create with numeric ID (should fail due to unique constraint)
      const request2: RequestType = {
        id: 'request-2',
        userId: 123 as any, // Will be coerced to '123'
        count: 200,
      };
      
      await expect(
        requestModel.set(request2.id, request2)
      ).rejects.toThrow('Unique constraint violation');
      
      // Verify the index key format
      const indexValue = await env.DEPLOYS_KV.get('index:request:userId:123');
      expect(indexValue).toBe('request-1');
    });
  });

  describe('Cleanup and Consistency', () => {
    it('should properly clean up indexes when deleting records', async () => {
      const requestModel = new RequestModel(ctx);
      
      const request: RequestType = {
        id: 'request-1',
        userId: '1',
        count: 100,
      };
      
      await requestModel.set(request.id, request);
      
      // Verify it exists
      const found = await requestModel.findByUserId('1');
      expect(found).toEqual(request);
      
      // Delete the record
      await requestModel.delete(request.id);
      
      // Verify it's gone
      const foundAfter = await requestModel.findByUserId('1');
      expect(foundAfter).toBeNull();
      
      // Verify KV is clean
      const mainRecord = await env.DEPLOYS_KV.get('request:request-1');
      expect(mainRecord).toBeNull();
      
      const indexRecord = await env.DEPLOYS_KV.get('index:request:userId:1');
      expect(indexRecord).toBeNull();
      
      // Now we can create a new record with same user ID
      const newRequest: RequestType = {
        id: 'request-2',
        userId: '1',
        count: 200,
      };
      
      await requestModel.set(newRequest.id, newRequest);
      
      const foundNew = await requestModel.findByUserId('1');
      expect(foundNew).toEqual(newRequest);
    });
  });
});