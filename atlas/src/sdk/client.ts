import { User, Website, Plan, Domain } from '../models/index.js';
import type { UserType, WebsiteType, PlanType, DomainType } from '../types.js';
import type { SDKContext, OperationResult } from './types.js';
export class SDKClient {
  private context: SDKContext;
  
  constructor(context: SDKContext) {
    this.context = context;
  }
  
  // User operations
  user = {
    get: async (id: string): Promise<OperationResult<UserType>> => {
      try {
        const model = new User(this.context as any);
        const data = await model.get(id);
        
        if (!data) {
          return { success: false, error: `User ${id} not found` };
        }
        
        return { success: true, data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    set: async (id: string, data: UserType): Promise<OperationResult<void>> => {
      try {
        const model = new User(this.context as any);
        await model.set(id, data);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    delete: async (id: string): Promise<OperationResult<void>> => {
      try {
        const model = new User(this.context as any);
        await model.delete(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    
    list: async (limit?: number): Promise<OperationResult<UserType[]>> => {
      try {
        const model = new User(this.context as any);
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
}