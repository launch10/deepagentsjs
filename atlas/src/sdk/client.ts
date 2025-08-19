import { Tenant, Site, Plan, Firewall } from '../models/index.js';
import type { TenantType, SiteType, PlanType } from '../types.js';
import type { SDKContext, OperationResult } from './types.js';

export class SDKClient {
  private context: SDKContext;
  
  constructor(context: SDKContext) {
    this.context = context;
  }
  
  // Tenant operations
  tenant = {
    get: async (id: string): Promise<OperationResult<TenantType>> => {
      try {
        const model = new Tenant(this.context as any);
        const data = await model.get(id);
        
        if (!data) {
          return { success: false, error: `Tenant ${id} not found` };
        }
        
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    set: async (id: string, data: TenantType): Promise<OperationResult<void>> => {
      try {
        const model = new Tenant(this.context as any);
        await model.set(id, data);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    delete: async (id: string): Promise<OperationResult<void>> => {
      try {
        const model = new Tenant(this.context as any);
        await model.delete(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    list: async (limit?: number): Promise<OperationResult<TenantType[]>> => {
      try {
        const model = new Tenant(this.context as any);
        const data = await model.listAll(limit);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    block: async (id: string): Promise<OperationResult<void>> => {
      try {
        const model = new Tenant(this.context as any);
        const tenant = await model.get(id);
        
        if (!tenant) {
          return { success: false, error: `Tenant ${id} not found` };
        }
        
        const firewall = new Firewall(this.context as any);
        await firewall.block(tenant);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    unblock: async (id: string): Promise<OperationResult<void>> => {
      try {
        const model = new Tenant(this.context as any);
        const tenant = await model.get(id);
        
        if (!tenant) {
          return { success: false, error: `Tenant ${id} not found` };
        }
        
        const firewall = new Firewall(this.context as any);
        await firewall.unblock(tenant);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    reset: async (id: string): Promise<OperationResult<void>> => {
      try {
        const model = new Tenant(this.context as any);
        const tenant = await model.get(id);
        
        if (!tenant) {
          return { success: false, error: `Tenant ${id} not found` };
        }
        
        const firewall = new Firewall(this.context as any);
        await firewall.reset(tenant);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  };
  
  // Site operations
  site = {
    get: async (id: string): Promise<OperationResult<SiteType>> => {
      try {
        const model = new Site(this.context as any);
        const data = await model.get(id);
        
        if (!data) {
          return { success: false, error: `Site ${id} not found` };
        }
        
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    set: async (id: string, data: SiteType): Promise<OperationResult<void>> => {
      try {
        const model = new Site(this.context as any);
        await model.set(id, data);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    delete: async (id: string): Promise<OperationResult<void>> => {
      try {
        const model = new Site(this.context as any);
        await model.delete(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    list: async (limit?: number): Promise<OperationResult<SiteType[]>> => {
      try {
        const model = new Site(this.context as any);
        const data = await model.listAll(limit);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    findByUrl: async (url: string): Promise<OperationResult<SiteType>> => {
      try {
        const model = new Site(this.context as any);
        const data = await model.findByUrl(url);
        
        if (!data) {
          return { success: false, error: `Site with URL ${url} not found` };
        }
        
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    findByTenant: async (tenantId: string): Promise<OperationResult<SiteType[]>> => {
      try {
        const model = new Site(this.context as any);
        const data = await model.findByTenant(tenantId);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  };
  
  // Plan operations
  plan = {
    get: async (id: string): Promise<OperationResult<PlanType>> => {
      try {
        const model = new Plan(this.context as any);
        const data = await model.get(id);
        
        if (!data) {
          return { success: false, error: `Plan ${id} not found` };
        }
        
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    set: async (id: string, data: PlanType): Promise<OperationResult<void>> => {
      try {
        const model = new Plan(this.context as any);
        await model.set(id, data);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    delete: async (id: string): Promise<OperationResult<void>> => {
      try {
        const model = new Plan(this.context as any);
        await model.delete(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    list: async (limit?: number): Promise<OperationResult<PlanType[]>> => {
      try {
        const model = new Plan(this.context as any);
        const data = await model.listAll(limit);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  };
}