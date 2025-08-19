import { Context } from "hono";
import { Env } from "~/types";
import { CloudflareContext } from "~/utils/cloudflareContext";

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

    private getListIndexKey(indexName: string, parentValue: string): string {
        return `list:${this.prefix}:${indexName}:${parentValue}`;
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
                console.log(`oh noes, failed validation for ${this.prefix}:${id}`)
                console.log(newData)
                throw new Error(`Invalid ${this.prefix} data for id: ${id}`);
            }

            // Store the main record
            await this.c.env.DEPLOYS_KV.put(this.getKey(id), JSON.stringify(newData));

            // Update indexes
            await this.updateIndexes(id, newData, existingData);
            
        } catch (error) {
            console.error(`Error setting ${this.prefix}:${id}`, error);
            throw new Error(`Failed to save ${this.prefix}: ${id}`);
        }
    }

    private async updateIndexes(
        id: string, 
        newData: T, 
        oldData: T | null
    ): Promise<void> {
        const operations: Promise<void>[] = [];

        for (const index of this.indexes) {
            // Clean up old index entries
            if (oldData) {
                const oldKeys = index.keyExtractor(oldData);
                if (oldKeys) {
                    const oldKeyArray = Array.isArray(oldKeys) ? oldKeys : [oldKeys];
                    for (const oldKey of oldKeyArray) {
                        if (index.type === 'unique') {
                            operations.push(
                                this.c.env.DEPLOYS_KV.delete(this.getIndexKey(index.name, oldKey))
                            );
                        } else {
                            operations.push(
                                this.removeFromListIndex(index.name, oldKey, id)
                            );
                        }
                    }
                }
            }

            // Add new index entries
            const newKeys = index.keyExtractor(newData);
            if (newKeys) {
                const newKeyArray = Array.isArray(newKeys) ? newKeys : [newKeys];
                for (const newKey of newKeyArray) {
                    if (index.type === 'unique') {
                        operations.push(
                            this.c.env.DEPLOYS_KV.put(this.getIndexKey(index.name, newKey), id)
                        );
                    } else {
                        operations.push(
                            this.addToListIndex(index.name, newKey, id)
                        );
                    }
                }
            }
        }

        await Promise.all(operations);
    }

    private async addToListIndex(
        indexName: string, 
        parentValue: string, 
        id: string
    ): Promise<void> {
        const listKey = this.getListIndexKey(indexName, parentValue);
        const existing = await this.c.env.DEPLOYS_KV.get(listKey);
        const list = existing ? JSON.parse(existing) as string[] : [];
        
        if (!list.includes(id)) {
            list.push(id);
            await this.c.env.DEPLOYS_KV.put(listKey, JSON.stringify(list));
        }
    }

    private async removeFromListIndex(
        
        indexName: string, 
        parentValue: string, 
        id: string
    ): Promise<void> {
        const listKey = this.getListIndexKey(indexName, parentValue);
        const existing = await this.c.env.DEPLOYS_KV.get(listKey);
        if (existing) {
            const list = JSON.parse(existing) as string[];
            const filtered = list.filter(item => item !== id);
            
            if (filtered.length === 0) {
                await this.c.env.DEPLOYS_KV.delete(listKey);
            } else {
                await this.c.env.DEPLOYS_KV.put(listKey, JSON.stringify(filtered));
            }
        }
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

    // Query by index
    async findByIndex(indexName: string, value: string): Promise<T | null> {
        const index = this.indexes.find(idx => idx.name === indexName);
        if (!index) {
            throw new Error(`Index '${indexName}' not found on ${this.prefix}`);
        }

        if (index.type !== 'unique') {
            throw new Error(`Index '${indexName}' is not unique, use findManyByIndex instead`);
        }

        const id = await this.c.env.DEPLOYS_KV.get(this.getIndexKey(indexName, value));
        return id ? await this.get(id) : null;
    }

    async findManyByIndex(indexName: string, value: string): Promise<T[]> {
        const index = this.indexes.find(idx => idx.name === indexName);
        if (!index) {
            throw new Error(`Index '${indexName}' not found on ${this.prefix}`);
        }

        let ids: string[] = [];

        if (index.type === 'unique') {
            const id = await this.c.env.DEPLOYS_KV.get(this.getIndexKey(indexName, value));
            if (id) ids = [id];
        } else {
            const listData = await this.c.env.DEPLOYS_KV.get(this.getListIndexKey(indexName, value));
            if (listData) {
                ids = JSON.parse(listData) as string[];
            }
        }

        const results = await Promise.all(ids.map(id => this.get(id)));
        return results.filter(item => item !== null) as T[];
    }

    // Generic where/filter method
    async where(filters: QueryFilter[]): Promise<T[]> {
        if (filters.length === 0) {
            throw new Error('At least one filter is required');
        }

        // For now, we'll handle single filter efficiently and multiple filters by intersection
        if (filters.length === 1) {
            return await this.findManyByIndex(filters[0].index, filters[0].value);
        }

        // Multiple filters - find intersection
        const resultSets = await Promise.all(
            filters.map(filter => this.findManyByIndex(filter.index, filter.value))
        );

        // Find intersection of all result sets
        if (resultSets.length === 0) return [];
        
        let intersection = resultSets[0];
        for (let i = 1; i < resultSets.length; i++) {
            intersection = intersection.filter(item => 
                resultSets[i].some(other => JSON.stringify(item) === JSON.stringify(other))
            );
        }

        return intersection;
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
