import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Context } from 'hono';
import { Firewall } from '~/models/firewall';
import { Env, FirewallType, TenantType } from '~/types';
import { Miniflare } from 'miniflare';
import { v4 as uuidv4 } from 'uuid';

describe('Firewall Model', () => {
  let mf: Miniflare;
  let env: Env;
  let ctx: Context<{ Bindings: Env }>;
  let firewallModel: Firewall;

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

    firewallModel = new Firewall(ctx);

    // Clear KV store before each test
    const keys = await env.DEPLOYS_KV.list();
    for (const key of keys.keys) {
      await env.DEPLOYS_KV.delete(key.name);
    }
  });

  describe('findByTenant', () => {
    it('should find firewall by tenant ID', async () => {
      const firewallData: FirewallType = {
        id: uuidv4(),
        tenantId: '1',
        status: 'blocked',
      };

      await firewallModel.set(firewallData.id, firewallData);
      const found = await firewallModel.findByTenant('1');

      expect(found).toEqual(firewallData);
    });

    it('should handle numeric tenant IDs', async () => {
      const firewallData: FirewallType = {
        id: uuidv4(),
        tenantId: '1',
        status: 'inactive',
      };

      await firewallModel.set(firewallData.id, firewallData);

      // Should find with numeric ID
      const foundByNumber = await firewallModel.findByTenant(1 as any);
      expect(foundByNumber).toEqual(firewallData);

      // Should find with string ID
      const foundByString = await firewallModel.findByTenant('1');
      expect(foundByString).toEqual(firewallData);
    });

    it('should prevent duplicate tenant IDs', async () => {
      const firewall1: FirewallType = {
        id: uuidv4(),
        tenantId: '1',
        status: 'blocked',
      };

      const firewall2: FirewallType = {
        id: uuidv4(),
        tenantId: '1', // Same tenant ID
        status: 'inactive',
      };

      await firewallModel.set(firewall1.id, firewall1);
      
      // Should throw unique constraint violation
      await expect(
        firewallModel.set(firewall2.id, firewall2)
      ).rejects.toThrow('Unique constraint violation');
    });
  });

  describe('findByStatus', () => {
    it('should find multiple firewalls by status', async () => {
      const firewalls: FirewallType[] = [
        { id: uuidv4(), tenantId: '1', status: 'blocked' },
        { id: uuidv4(), tenantId: '2', status: 'blocked' },
        { id: uuidv4(), tenantId: '3', status: 'inactive' },
        { id: uuidv4(), tenantId: '4', status: 'monitoring' },
      ];

      for (const fw of firewalls) {
        await firewallModel.set(fw.id, fw);
      }

      const blocked = await firewallModel.findByStatus('blocked');
      expect(blocked).toHaveLength(2);
      expect(blocked.map(f => f.tenantId).sort()).toEqual(['1', '2']);

      const inactive = await firewallModel.findByStatus('inactive');
      expect(inactive).toHaveLength(1);
      expect(inactive[0].tenantId).toBe('3');

      const monitoring = await firewallModel.findByStatus('monitoring');
      expect(monitoring).toHaveLength(1);
      expect(monitoring[0].tenantId).toBe('4');
    });
  });

  describe('Real-world scenario: block/unblock operations', () => {
    it('should not create duplicate firewalls during block operation', async () => {
      const tenant: TenantType = {
        id: '1',
        orgId: '1',
        planId: '1',
      };

      // Mock dependencies needed for block operation
      const mockSiteModel = {
        findByTenant: vi.fn().mockResolvedValue([]),
      };
      const mockFirewallRuleModel = {
        findByTenant: vi.fn().mockResolvedValue([]),
        block: vi.fn().mockResolvedValue(undefined),
      };

      // Inject mocks (this would require refactoring the actual code to support DI)
      // For now, we'll test the core functionality

      // First block operation
      const existingFirewall = await firewallModel.findByTenant(tenant.id);
      const firewall1 = existingFirewall || {
        id: uuidv4(),
        tenantId: String(tenant.id),
        status: 'blocked' as const,
      };
      await firewallModel.set(firewall1.id, firewall1);

      // Simulate another block operation (potential race condition)
      const firewall2 = {
        id: uuidv4(),
        tenantId: String(tenant.id),
        status: 'blocked' as const,
      };

      // Should fail due to unique constraint
      await expect(
        firewallModel.set(firewall2.id, firewall2)
      ).rejects.toThrow('Unique constraint violation');

      // Verify only one firewall exists
      const finalFirewall = await firewallModel.findByTenant(tenant.id);
      expect(finalFirewall?.id).toBe(firewall1.id);
    });

    it('should update existing firewall status without creating duplicates', async () => {
      const tenant: TenantType = {
        id: '1',
        orgId: '1',
        planId: '1',
      };

      // Create initial firewall
      const initialFirewall: FirewallType = {
        id: uuidv4(),
        tenantId: String(tenant.id),
        status: 'inactive',
      };
      await firewallModel.set(initialFirewall.id, initialFirewall);

      // Update to blocked
      const existing = await firewallModel.findByTenant(tenant.id);
      expect(existing).not.toBeNull();
      await firewallModel.set(existing!.id, { status: 'blocked' });

      // Verify status updated
      const updated = await firewallModel.findByTenant(tenant.id);
      expect(updated?.status).toBe('blocked');
      expect(updated?.id).toBe(initialFirewall.id);

      // Update to monitoring
      await firewallModel.set(existing!.id, { status: 'monitoring' });
      const monitoring = await firewallModel.findByTenant(tenant.id);
      expect(monitoring?.status).toBe('monitoring');
      expect(monitoring?.id).toBe(initialFirewall.id);
    });
  });

  describe('KV storage verification', () => {
    it('should store correct keys in KV', async () => {
      const firewallData: FirewallType = {
        id: 'firewall-123',
        tenantId: '1',
        status: 'blocked',
      };

      await firewallModel.set(firewallData.id, firewallData);

      // Check main record
      const mainKey = 'firewall:firewall-123';
      const mainValue = await env.DEPLOYS_KV.get(mainKey);
      expect(JSON.parse(mainValue!)).toEqual(firewallData);

      // Check unique index for tenantId
      const tenantIndexKey = 'index:firewall:tenantId:1';
      const tenantIndexValue = await env.DEPLOYS_KV.get(tenantIndexKey);
      expect(tenantIndexValue).toBe('firewall-123');

      // Check list index for status
      const statusIndexKey = 'list:firewall:status:blocked';
      const statusIndexValue = await env.DEPLOYS_KV.get(statusIndexKey);
      expect(JSON.parse(statusIndexValue!)).toEqual(['firewall-123']);
    });

    it('should update indexes when status changes', async () => {
      const firewallData: FirewallType = {
        id: 'firewall-123',
        tenantId: '1',
        status: 'inactive',
      };

      await firewallModel.set(firewallData.id, firewallData);

      // Check initial status index
      let inactiveIndex = await env.DEPLOYS_KV.get('list:firewall:status:inactive');
      expect(JSON.parse(inactiveIndex!)).toEqual(['firewall-123']);

      // Update status
      await firewallModel.set(firewallData.id, { status: 'blocked' });

      // Check indexes updated
      inactiveIndex = await env.DEPLOYS_KV.get('list:firewall:status:inactive');
      expect(inactiveIndex).toBeNull();

      const blockedIndex = await env.DEPLOYS_KV.get('list:firewall:status:blocked');
      expect(JSON.parse(blockedIndex!)).toEqual(['firewall-123']);
    });
  });
});