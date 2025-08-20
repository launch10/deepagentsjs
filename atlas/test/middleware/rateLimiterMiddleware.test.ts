import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Context, Next } from 'hono';
import { Env, TenantType, SiteType, FirewallType, RequestType, PlanType } from '~/types';
import { Miniflare } from 'miniflare';
import { rateLimiterMiddleware } from '~/middleware/rateLimiter/rateLimiterMiddleware';
import { v4 as uuidv4 } from 'uuid';

// Mock the models
vi.mock('~/models', () => {
  return {
    Tenant: vi.fn(),
    Site: vi.fn(),
    Firewall: vi.fn(),
    Request: vi.fn(),
    Plan: vi.fn(),
  };
});

describe('RateLimiterMiddleware', () => {
  let mf: Miniflare;
  let env: Env;
  let ctx: Context<{ Bindings: Env }>;
  let next: Next;
  let kvStore: Map<string, string>;

  // Mock model instances
  let mockSiteModel: any;
  let mockTenantModel: any;
  let mockFirewallModel: any;
  let mockRequestModel: any;
  let mockPlanModel: any;

  beforeEach(async () => {
    // Set up in-memory KV store
    kvStore = new Map();

    // Set up Miniflare environment
    mf = new Miniflare({
      modules: true,
      script: `export default { fetch: () => new Response() }`,
      kvNamespaces: ['DEPLOYS_KV'],
    });

    const realKV = await mf.getKVNamespace('DEPLOYS_KV');

    // Create a wrapped KV that logs all operations
    const kvWrapper = {
      get: async (key: string) => {
        console.log(`[KV GET] ${key}`);
        const value = await realKV.get(key);
        console.log(`[KV GET Result] ${key} = ${value}`);
        return value;
      },
      put: async (key: string, value: string) => {
        console.log(`[KV PUT] ${key} = ${value}`);
        return realKV.put(key, value);
      },
      delete: async (key: string) => {
        console.log(`[KV DELETE] ${key}`);
        return realKV.delete(key);
      },
      list: async (options?: any) => {
        return realKV.list(options);
      },
    };

    env = {
      DEPLOYS_KV: kvWrapper as any,
    } as Env;

    // Mock next function
    next = vi.fn().mockResolvedValue(undefined);

    // Clear KV store
    const keys = await realKV.list();
    for (const key of keys.keys) {
      await realKV.delete(key.name);
    }

    // Set up mock models
    const { Site, Tenant, Firewall, Request, Plan } = await import('~/models');

    mockSiteModel = {
      findByUrl: vi.fn(),
    };
    (Site as any).mockImplementation(() => mockSiteModel);

    mockTenantModel = {
      get: vi.fn(),
    };
    (Tenant as any).mockImplementation(() => mockTenantModel);

    mockFirewallModel = {
      findByTenant: vi.fn(),
      shouldBlock: vi.fn(),
      block: vi.fn(),
      set: vi.fn(),
    };
    (Firewall as any).mockImplementation(() => mockFirewallModel);

    mockRequestModel = {
      findByTenantId: vi.fn(),
      set: vi.fn(),
    };
    (Request as any).mockImplementation(() => mockRequestModel);

    mockPlanModel = {
      get: vi.fn(),
      getMonthlyLimit: vi.fn(),
    };
    (Plan as any).mockImplementation(() => mockPlanModel);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Document request filtering', () => {
    it('should skip non-document requests', async () => {
      ctx = {
        env,
        req: {
          url: 'http://test.example.com/assets/image.png',
        },
        json: vi.fn(),
      } as unknown as Context<{ Bindings: Env }>;

      await rateLimiterMiddleware(ctx, next);

      expect(next).toHaveBeenCalled();
      expect(mockSiteModel.findByUrl).not.toHaveBeenCalled();
    });

    it('should process document requests', async () => {
      const site: SiteType = {
        id: '1',
        url: 'test.example.com',
        tenantId: '1',
        live: 'INITIAL',
        preview: 'INITIAL',
      };

      const tenant: TenantType = {
        id: '1',
        orgId: '1',
        planId: '1',
      };

      mockSiteModel.findByUrl.mockResolvedValue(site);
      mockTenantModel.get.mockResolvedValue(tenant);
      mockFirewallModel.findByTenant.mockResolvedValue(null);
      mockRequestModel.findByTenantId.mockResolvedValue(null);

      ctx = {
        env,
        req: {
          url: 'http://test.example.com/',
        },
        json: vi.fn(),
      } as unknown as Context<{ Bindings: Env }>;

      await rateLimiterMiddleware(ctx, next);

      expect(mockSiteModel.findByUrl).toHaveBeenCalledWith('http://test.example.com/');
      expect(mockTenantModel.get).toHaveBeenCalledWith('1');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Request counting and unique constraints', () => {
    it('should create request record on first visit', async () => {
      const site: SiteType = {
        id: '1',
        url: 'test.example.com',
        tenantId: '1',
        live: 'INITIAL',
        preview: 'INITIAL',
      };

      const tenant: TenantType = {
        id: '1',
        orgId: '1',
        planId: '1',
      };

      const plan: PlanType = {
        id: '1',
        name: 'starter',
        usageLimit: 1000,
      };

      mockSiteModel.findByUrl.mockResolvedValue(site);
      mockTenantModel.get.mockResolvedValue(tenant);
      mockFirewallModel.findByTenant.mockResolvedValue(null);
      mockRequestModel.findByTenantId.mockResolvedValue(null);
      mockPlanModel.get.mockResolvedValue(plan);
      mockPlanModel.getMonthlyLimit.mockReturnValue(1000);

      ctx = {
        env,
        req: {
          url: 'http://test.example.com/',
        },
        json: vi.fn(),
      } as unknown as Context<{ Bindings: Env }>;

      // Simulate 10 requests to trigger batch write
      for (let i = 0; i < 10; i++) {
        await rateLimiterMiddleware(ctx, next);
      }

      // Should have created a new request record
      expect(mockRequestModel.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tenantId: '1',
          count: 10,
        })
      );
    });

    it('should update existing request record', async () => {
      const site: SiteType = {
        id: '1',
        url: 'test.example.com',
        tenantId: '1',
        live: 'INITIAL',
        preview: 'INITIAL',
      };

      const tenant: TenantType = {
        id: '1',
        orgId: '1',
        planId: '1',
      };

      const existingRequest: RequestType = {
        id: 'request-123',
        tenantId: '1',
        count: 100,
      };

      const plan: PlanType = {
        id: '1',
        name: 'starter',
        usageLimit: 1000,
      };

      mockSiteModel.findByUrl.mockResolvedValue(site);
      mockTenantModel.get.mockResolvedValue(tenant);
      mockFirewallModel.findByTenant.mockResolvedValue(null);
      mockRequestModel.findByTenantId.mockResolvedValue(existingRequest);
      mockPlanModel.get.mockResolvedValue(plan);
      mockPlanModel.getMonthlyLimit.mockReturnValue(1000);

      ctx = {
        env,
        req: {
          url: 'http://test.example.com/',
        },
        json: vi.fn(),
      } as unknown as Context<{ Bindings: Env }>;

      // Simulate 10 requests to trigger batch write
      for (let i = 0; i < 10; i++) {
        await rateLimiterMiddleware(ctx, next);
      }

      // Should update the existing record, not create a new one
      expect(mockRequestModel.set).toHaveBeenCalledWith(
        'request-123', // Use existing ID
        expect.objectContaining({
          count: 110, // 100 + 10
        })
      );
    });

    it('should handle numeric tenant IDs correctly', async () => {
      const site: SiteType = {
        id: '1',
        url: 'test.example.com',
        tenantId: 1 as any, // Numeric tenant ID
        live: 'INITIAL',
        preview: 'INITIAL',
      };

      const tenant: TenantType = {
        id: 1 as any, // Numeric ID
        orgId: '1',
        planId: '1',
      };

      const plan: PlanType = {
        id: '1',
        name: 'starter',
        usageLimit: 1000,
      };

      mockSiteModel.findByUrl.mockResolvedValue(site);
      mockTenantModel.get.mockResolvedValue(tenant);
      mockFirewallModel.findByTenant.mockResolvedValue(null);
      mockRequestModel.findByTenantId.mockResolvedValue(null);
      mockPlanModel.get.mockResolvedValue(plan);
      mockPlanModel.getMonthlyLimit.mockReturnValue(1000);

      ctx = {
        env,
        req: {
          url: 'http://test.example.com/',
        },
        json: vi.fn(),
      } as unknown as Context<{ Bindings: Env }>;

      // Process requests
      for (let i = 0; i < 10; i++) {
        await rateLimiterMiddleware(ctx, next);
      }

      // Should handle numeric IDs properly
      expect(mockRequestModel.findByTenantId).toHaveBeenCalledWith(1);
      expect(mockRequestModel.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tenantId: '1', // Should convert to string
        })
      );
    });
  });

  describe('Firewall blocking', () => {
    it('should block when firewall status is blocked', async () => {
      const site: SiteType = {
        id: '1',
        url: 'test.example.com',
        tenantId: '1',
        live: 'INITIAL',
        preview: 'INITIAL',
      };

      const tenant: TenantType = {
        id: '1',
        orgId: '1',
        planId: '1',
      };

      const firewall: FirewallType = {
        id: 'fw-1',
        tenantId: '1',
        status: 'blocked',
      };

      mockSiteModel.findByUrl.mockResolvedValue(site);
      mockTenantModel.get.mockResolvedValue(tenant);
      mockFirewallModel.findByTenant.mockResolvedValue(firewall);

      ctx = {
        env,
        req: {
          url: 'http://test.example.com/',
        },
        json: vi.fn().mockReturnValue({ error: 'Rate limit exceeded' }),
      } as unknown as Context<{ Bindings: Env }>;

      await rateLimiterMiddleware(ctx, next);

      expect(mockFirewallModel.block).toHaveBeenCalledWith(tenant);
      expect(ctx.json).toHaveBeenCalledWith({ error: 'Rate limit exceeded' }, 429);
      expect(next).not.toHaveBeenCalled();
    });

    it('should check shouldBlock when status is monitoring', async () => {
      const site: SiteType = {
        id: '1',
        url: 'test.example.com',
        tenantId: '1',
        live: 'INITIAL',
        preview: 'INITIAL',
      };

      const tenant: TenantType = {
        id: '1',
        orgId: '1',
        planId: '1',
      };

      const firewall: FirewallType = {
        id: 'fw-1',
        tenantId: '1',
        status: 'monitoring',
      };

      mockSiteModel.findByUrl.mockResolvedValue(site);
      mockTenantModel.get.mockResolvedValue(tenant);
      mockFirewallModel.findByTenant.mockResolvedValue(firewall);
      mockFirewallModel.shouldBlock.mockResolvedValue(false);
      mockRequestModel.findByTenantId.mockResolvedValue(null);

      ctx = {
        env,
        req: {
          url: 'http://test.example.com/',
        },
        json: vi.fn(),
      } as unknown as Context<{ Bindings: Env }>;

      await rateLimiterMiddleware(ctx, next);

      expect(mockFirewallModel.shouldBlock).toHaveBeenCalledWith(tenant);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Threshold crossing', () => {
    it('should activate monitoring when threshold is crossed', async () => {
      const site: SiteType = {
        id: '1',
        url: 'test.example.com',
        tenantId: '1',
        live: 'INITIAL',
        preview: 'INITIAL',
      };

      const tenant: TenantType = {
        id: '1',
        orgId: '1',
        planId: '1',
      };

      const plan: PlanType = {
        id: '1',
        name: 'starter',
        usageLimit: 100, // Low limit for testing
      };

      const existingRequest: RequestType = {
        id: 'request-123',
        tenantId: '1',
        count: 85, // Close to threshold (90% of 100)
      };

      mockSiteModel.findByUrl.mockResolvedValue(site);
      mockTenantModel.get.mockResolvedValue(tenant);
      mockFirewallModel.findByTenant.mockResolvedValue(null);
      mockRequestModel.findByTenantId.mockResolvedValue(existingRequest);
      mockPlanModel.get.mockResolvedValue(plan);
      mockPlanModel.getMonthlyLimit.mockReturnValue(100);

      ctx = {
        env,
        req: {
          url: 'http://test.example.com/',
        },
        json: vi.fn(),
      } as unknown as Context<{ Bindings: Env }>;

      // Process 10 requests to cross threshold
      for (let i = 0; i < 10; i++) {
        await rateLimiterMiddleware(ctx, next);
      }

      // Should activate monitoring
      expect(mockFirewallModel.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tenantId: '1',
          status: 'monitoring',
        })
      );
    });

    it('should not create duplicate firewall when crossing threshold', async () => {
      const site: SiteType = {
        id: '1',
        url: 'test.example.com',
        tenantId: '1',
        live: 'INITIAL',
        preview: 'INITIAL',
      };

      const tenant: TenantType = {
        id: '1',
        orgId: '1',
        planId: '1',
      };

      const plan: PlanType = {
        id: '1',
        name: 'starter',
        usageLimit: 100,
      };

      const existingRequest: RequestType = {
        id: 'request-123',
        tenantId: '1',
        count: 85,
      };

      const existingFirewall: FirewallType = {
        id: 'fw-existing',
        tenantId: '1',
        status: 'inactive',
      };

      mockSiteModel.findByUrl.mockResolvedValue(site);
      mockTenantModel.get.mockResolvedValue(tenant);
      
      // The middleware calls findByTenant:
      // - Once per request in the main flow (calls 1-8 for first 8 requests)
      // - On the 10th request, batch processing happens which calls afterThresholdCrossed
      // - afterThresholdCrossed calls findByTenant (call #9)
      // - Then the main flow continues for the last 2 requests (calls 10-11)
      let findByTenantCallCount = 0;
      mockFirewallModel.findByTenant.mockImplementation(async () => {
        findByTenantCallCount++;
        // The 9th call is from afterThresholdCrossed - return existing firewall
        if (findByTenantCallCount === 9) {
          return existingFirewall;
        }
        // All other calls return null
        return null;
      });
      
      mockRequestModel.findByTenantId.mockResolvedValue(existingRequest);
      mockPlanModel.get.mockResolvedValue(plan);
      mockPlanModel.getMonthlyLimit.mockReturnValue(100);

      ctx = {
        env,
        req: {
          url: 'http://test.example.com/',
        },
        json: vi.fn(),
      } as unknown as Context<{ Bindings: Env }>;

      // Process requests to cross threshold
      for (let i = 0; i < 10; i++) {
        await rateLimiterMiddleware(ctx, next);
      }

      // Should update existing firewall using its ID
      expect(mockFirewallModel.set).toHaveBeenCalledWith(
        'fw-existing', // Should use existing firewall ID
        expect.objectContaining({
          status: 'monitoring',
          tenantId: '1',
          id: 'fw-existing',
        })
      );
    });
  });

  describe('Race condition prevention', () => {
    it('should handle concurrent requests without creating duplicates', async () => {
      const site: SiteType = {
        id: '1',
        url: 'test.example.com',
        tenantId: '1',
        live: 'INITIAL',
        preview: 'INITIAL',
      };

      const tenant: TenantType = {
        id: '1',
        orgId: '1',
        planId: '1',
      };

      const plan: PlanType = {
        id: '1',
        name: 'starter',
        usageLimit: 1000,
      };

      mockSiteModel.findByUrl.mockResolvedValue(site);
      mockTenantModel.get.mockResolvedValue(tenant);
      mockFirewallModel.findByTenant.mockResolvedValue(null);
      mockPlanModel.get.mockResolvedValue(plan);
      mockPlanModel.getMonthlyLimit.mockReturnValue(1000);
      
      // Simulate race condition: first call returns null, subsequent calls return existing
      const existingRequest: RequestType = {
        id: 'request-123',
        tenantId: '1',
        count: 10,
      };
      
      mockRequestModel.findByTenantId
        .mockResolvedValueOnce(null) // First batch finds nothing
        .mockResolvedValue(existingRequest); // Subsequent batches find existing

      ctx = {
        env,
        req: {
          url: 'http://test.example.com/',
        },
        json: vi.fn(),
      } as unknown as Context<{ Bindings: Env }>;

      // Simulate concurrent batches
      const promises = [];
      for (let batch = 0; batch < 3; batch++) {
        for (let i = 0; i < 10; i++) {
          promises.push(rateLimiterMiddleware(ctx, next));
        }
      }

      await Promise.all(promises);

      // First call should create new record
      expect(mockRequestModel.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tenantId: '1',
          count: 10,
        })
      );

      // Subsequent calls should update existing
      expect(mockRequestModel.set).toHaveBeenCalledWith(
        'request-123',
        expect.objectContaining({
          count: expect.any(Number),
        })
      );
    });
  });
});