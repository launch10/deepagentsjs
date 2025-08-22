import { Context } from "hono";
import { Env } from "~/types";
import { CloudflareContext } from "~/utils/cloudflareContext";
import { logger } from "~/utils/logger";

export const scopedLogger = logger.addScope('KVCache');

// Index definition interface
export interface IndexDefinition<T> {
    name: string;
    keyExtractor: (data: T) => string | string[] | null;
    type: 'unique' | 'list'; // unique for 1:1, list for 1:many
}

export interface QueryFilter {
    index: string;
    value: string;
}

// Generic KV Model class with indexing support
export class BaseModel<T> extends CloudflareContext {
    protected prefix: string;
    protected validator?: (data: any) => data is T;
    protected indexes: IndexDefinition<T>[] = [];

    constructor(c: Context<{ Bindings: Env }>, prefix: string, validator?: (data: any) => data is T) {
        super(c);
        this.prefix = prefix;
        this.validator = validator;
        this.defineIndexes();
    }

    // Hook for subclasses to define their indexes
    protected defineIndexes(): void {
        // Override in subclasses
    }

    // Add an index definition
    protected addIndex(index: IndexDefinition<T>): void {
        this.indexes.push(index);
    }

    private getKey(id: string): string {
        return `${this.prefix}:${id}`;
    }

    private getIndexKey(indexName: string, value: string): string {
        return `index:${this.prefix}:${indexName}:${value}`;
    }

    async get(id: string): Promise<T | null> {
        try {
            const data = await this.c.env.DEPLOYS_KV.get(this.getKey(id));
            if (!data) return null;
            
            const parsed = JSON.parse(data) as T;
            
            if (this.validator && !this.validator(parsed)) {
                throw new Error(`Invalid data format for ${this.prefix}:${id}`);
            }
            
            return parsed;
        } catch (error) {
            console.error(`Error getting ${this.prefix}:${id}`, error);
            return null;
        }
    }

    async set(id: string, data: Partial<T>): Promise<void> {
        if (!data) {
            throw new Error(`${this.prefix} data is required`);
        }

        try {
            // Get existing data to clean up old indexes
            const existingData = await this.get(id);
            const newData = { ...existingData, ...data } as T;
            
            if (this.validator && !this.validator(newData)) {
                throw new Error(`Invalid ${this.prefix} data for id: ${id}`);
            }

            // Check for unique index violations BEFORE saving
            for (const index of this.indexes) {
                if (index.type === 'unique') {
                    const newKey = index.keyExtractor(newData);
                    if (newKey && (!existingData || index.keyExtractor(existingData) !== newKey)) {
                        const indexKey = this.getIndexKey(index.name, Array.isArray(newKey) ? newKey[0] : newKey);
                        const existingId = await this.c.env.DEPLOYS_KV.get(indexKey);
                        if (existingId && existingId !== id) {
                            console.error(`Unique index violation: ${indexKey} already points to ${existingId}, cannot set to ${id}`);
                            throw new Error(`Unique constraint violation: ${this.prefix} with ${index.name}=${newKey} already exists`);
                        }
                    }
                }
            }

            // Store the main record
            scopedLogger.debug(`Storing main record for ${this.prefix}:${id}`);
            await this.c.env.DEPLOYS_KV.put(this.getKey(id), JSON.stringify(newData));

            // Update indexes
            scopedLogger.debug(`Updating indexes for ${this.prefix}:${id}`);
            await this.updateIndexes(id, newData, existingData);
            
        } catch (error) {
            console.error(`Error setting ${this.prefix}:${id}`, error);
            throw error;
        }
    }

    private async updateIndexes(
        id: string, 
        newData: T, 
        oldData: T | null
    ): Promise<void> {
        const operations: Promise<void>[] = [];

        for (const index of this.indexes) {
            const oldKeys = oldData ? index.keyExtractor(oldData) : null;
            const newKeys = index.keyExtractor(newData);
            
            // Convert to arrays for comparison
            const oldKeyArray = oldKeys ? (Array.isArray(oldKeys) ? oldKeys : [oldKeys]) : [];
            const newKeyArray = newKeys ? (Array.isArray(newKeys) ? newKeys : [newKeys]) : [];
            
            // Only clean up old entries that are different from new ones
            for (const oldKey of oldKeyArray) {
                if (!newKeyArray.includes(oldKey)) {
                    if (index.type === 'unique') {
                        operations.push(
                            this.c.env.DEPLOYS_KV.delete(this.getIndexKey(index.name, oldKey))
                        );
                    } else {
                        throw new Error(`Unsupported index type: ${index.type}`);
                    }
                }
            }

            // Only add new entries that are different from old ones
            for (const newKey of newKeyArray) {
                if (!oldKeyArray.includes(newKey)) {
                    if (index.type === 'unique') {
                        const indexKey = this.getIndexKey(index.name, newKey);
                        scopedLogger.debug(`[updateIndexes] Creating index: ${indexKey} -> ${id}`);
                        scopedLogger.debug(`[updateIndexes] Key type: ${typeof newKey}, Key value: ${newKey}`);
                        operations.push(
                            this.c.env.DEPLOYS_KV.put(indexKey, id)
                        );
                    } else {
                        throw new Error(`Unsupported index type: ${index.type}`);
                    }
                } else {
                    scopedLogger.debug(`[updateIndexes] Skipping unchanged index ${index.name} with value ${newKey}`);
                    throw new Error(`Unsupported index type: ${index.type}`);
                }
            }
            
            if (!newKeys) {
                scopedLogger.debug(`[updateIndexes] No keys extracted for index ${index.name} from data:`, newData);
            }
        }

        await Promise.all(operations);
    }

    async delete(id: string): Promise<void> {
        try {
            const existingData = await this.get(id);
            
            // Delete main record
            await this.c.env.DEPLOYS_KV.delete(this.getKey(id));
            
            // Clean up indexes
            if (existingData) {
                await this.updateIndexes(id, {} as T, existingData);
            }
        } catch (error) {
            console.error(`Error deleting ${this.prefix}:${id}`, error);
            throw new Error(`Failed to delete ${this.prefix}: ${id}`);
        }
    }

    // Find or create by unique index
    async findOrCreateByIndex(indexName: string, value: string, createData: () => T | Promise<T>): Promise<T> {
        const index = this.indexes.find(idx => idx.name === indexName);
        if (!index) {
            throw new Error(`Index '${indexName}' not found on ${this.prefix}`);
        }

        if (index.type !== 'unique') {
            throw new Error(`Index '${indexName}' is not unique, findOrCreate only works with unique indexes`);
        }

        // Try to find existing record
        const existing = await this.findByIndex(indexName, value);
        if (existing) {
            return existing;
        }

        // Create new record
        const newRecord = await createData();
        const id = (newRecord as any).id;
        if (!id) {
            throw new Error(`Created record must have an id field`);
        }

        await this.set(id, newRecord);
        return newRecord;
    }

    // Query by index
    async findByIndex(indexName: string, value: string): Promise<T | null> {
        const index = this.indexes.find(idx => idx.name === indexName);
        if (!index) {
            throw new Error(`Index '${indexName}' not found on ${this.prefix}`);
        }

        if (index.type !== 'unique') {
            throw new Error(`Index '${indexName}' is not unique, use findManyByIndex instead`);
        }

        const indexKey = this.getIndexKey(indexName, value);
        scopedLogger.debug(`[findByIndex] Looking up index key: ${indexKey}`);
        scopedLogger.debug(`[findByIndex] Value type: ${typeof value}, Value: ${value}`);
        
        const id = await this.c.env.DEPLOYS_KV.get(indexKey);
        scopedLogger.debug(`[findByIndex] Found ID: ${id}`);
        
        return id ? await this.get(id) : null;
    }

    async exists(id: string): Promise<boolean> {
        const data = await this.get(id);
        return data !== null;
    }

    // List all entities (use with caution on large datasets)
    async listAll(limit?: number): Promise<T[]> {
        const keys = await this.c.env.DEPLOYS_KV.list({ prefix: `${this.prefix}:`, limit });
        const results = await Promise.all(
            keys.keys.map(key => {
                const id = key.name.replace(`${this.prefix}:`, '');
                return this.get(id);
            })
        );
        return results.filter(item => item !== null) as T[];
    }
}

// Type guard helper function
export function createTypeGuard<T>(validator: (data: any) => boolean): (data: any) => data is T {
    return (data: any): data is T => validator(data);
}
