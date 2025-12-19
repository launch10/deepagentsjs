import { Account, Website, Plan, Domain, WebsiteUrl } from '../models/index.js';
import type { AccountType, WebsiteType, PlanType, DomainType, WebsiteUrlType } from '../types.js';
import type { SDKContext, OperationResult } from './types.js';
export class SDKClient {
  private context: SDKContext;
  
  constructor(context: SDKContext) {
    this.context = context;
  }
  
  // Account operations
  account = {
    get: async (id: string): Promise<OperationResult<AccountType>> => {
      try {
        const model = new Account(this.context as any);
        const data = await model.get(id);
        
        if (!data) {
          return { success: false, error: `Account ${id} not found` };
        }
        
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    set: async (id: string, data: AccountType): Promise<OperationResult<void>> => {
      try {
        const model = new Account(this.context as any);
        await model.set(id, data);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    delete: async (id: string): Promise<OperationResult<void>> => {
      try {
        const model = new Account(this.context as any);
        await model.delete(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    list: async (limit?: number): Promise<OperationResult<AccountType[]>> => {
      try {
        const model = new Account(this.context as any);
        const data = await model.listAll(limit);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  };
  
  // Website operations
  website = {
    get: async (id: string): Promise<OperationResult<WebsiteType>> => {
      try {
        const model = new Website(this.context as any);
        const data = await model.get(id);
        
        if (!data) {
          return { success: false, error: `Website ${id} not found` };
        }
        
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    set: async (id: string, data: WebsiteType): Promise<OperationResult<void>> => {
      try {
        const model = new Website(this.context as any);
        await model.set(id, data);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    delete: async (id: string): Promise<OperationResult<void>> => {
      try {
        const model = new Website(this.context as any);
        await model.delete(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    list: async (limit?: number): Promise<OperationResult<WebsiteType[]>> => {
      try {
        const model = new Website(this.context as any);
        const data = await model.listAll(limit);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    findByUrl: async (url: string): Promise<OperationResult<WebsiteType>> => {
      try {
        const model = new Website(this.context as any);
        const data = await model.findByUrl(url);
        
        if (!data) {
          return { success: false, error: `Website with URL ${url} not found` };
        }
        
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
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
  
  // Domain operations
  domain = {
    get: async (id: string): Promise<OperationResult<DomainType>> => {
      try {
        const model = new Domain(this.context as any);
        const data = await model.get(id);
        
        if (!data) {
          return { success: false, error: `Domain ${id} not found` };
        }
        
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    set: async (id: string, data: DomainType): Promise<OperationResult<void>> => {
      try {
        const model = new Domain(this.context as any);
        await model.set(id, data);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    delete: async (id: string): Promise<OperationResult<void>> => {
      try {
        const model = new Domain(this.context as any);
        await model.delete(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    list: async (limit?: number, websiteId?: string): Promise<OperationResult<DomainType[]>> => {
      try {
        const model = new Domain(this.context as any);
        
        if (websiteId) {
          const data = await model.findByWebsiteId(websiteId);
          return { success: true, data };
        }
        
        const data = await model.listAll(limit);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    findByUrl: async (url: string): Promise<OperationResult<DomainType>> => {
      try {
        const model = new Domain(this.context as any);
        const data = await model.findByUrl(url);
        
        if (!data) {
          return { success: false, error: `Domain with URL ${url} not found` };
        }
        
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    findByWebsiteId: async (websiteId: string): Promise<OperationResult<DomainType[]>> => {
      try {
        const model = new Domain(this.context as any);
        const data = await model.findByWebsiteId(websiteId);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  };

  websiteUrl = {
    get: async (id: string): Promise<OperationResult<WebsiteUrlType>> => {
      try {
        const model = new WebsiteUrl(this.context as any);
        const data = await model.get(id);
        
        if (!data) {
          return { success: false, error: `WebsiteUrl ${id} not found` };
        }
        
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    set: async (id: string, data: WebsiteUrlType): Promise<OperationResult<void>> => {
      try {
        const model = new WebsiteUrl(this.context as any);
        await model.set(id, data);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    delete: async (id: string): Promise<OperationResult<void>> => {
      try {
        const model = new WebsiteUrl(this.context as any);
        await model.delete(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    list: async (limit?: number): Promise<OperationResult<WebsiteUrlType[]>> => {
      try {
        const model = new WebsiteUrl(this.context as any);
        const data = await model.listAll(limit);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    findByDomainAndPath: async (domain: string, path: string): Promise<OperationResult<WebsiteUrlType>> => {
      try {
        const model = new WebsiteUrl(this.context as any);
        const data = await model.findByDomainAndPath(domain, path);
        
        if (!data) {
          return { success: false, error: `WebsiteUrl with domain ${domain} and path ${path} not found` };
        }
        
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    findByWebsiteId: async (websiteId: string): Promise<OperationResult<WebsiteUrlType | null>> => {
      try {
        const model = new WebsiteUrl(this.context as any);
        const data = await model.findByWebsiteId(websiteId);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  };
}