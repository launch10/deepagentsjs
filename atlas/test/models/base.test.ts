import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Context } from 'hono';
import { BaseModel, createTypeGuard } from '~/models/base';
import { Env } from '~/types';
import { Miniflare } from 'miniflare';

// Test model type
interface TestModel {
  id: string;
  name: string;
  userId: string;
  category?: string;
  count?: number;
}

// Type guard for test model
const isTestModel = createTypeGuard<TestModel>(
  (data: any): data is TestModel => {
    return data.id !== undefined &&
      data.name !== undefined &&
      data.userId !== undefined;
  }
);

// Test model class
class TestModelClass extends BaseModel<TestModel> {
  constructor(c: Context<{ Bindings: Env }>) {
    super(c, 'test', isTestModel);
  }

  protected defineIndexes(): void {
    this.addIndex({
      name: 'userId',
      keyExtractor: (model) => model.userId || null,
      type: 'unique'
    });
    
    this.addIndex({
      name: 'category',
      keyExtractor: (model) => model.category || null,
      type: 'list'
    });
  }

  async findByUserId(userId: string | number): Promise<TestModel | null> {
    return this.findByIndex('userId', String(userId));
  }

  async findByCategory(category: string): Promise<TestModel[]> {
    return this.findManyByIndex('category', category);
  }
}

describe('BaseModel', () => {
  let mf: Miniflare;
  let env: Env;
  let ctx: Context<{ Bindings: Env }>;
  let testModel: TestModelClass;

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

    testModel = new TestModelClass(ctx);

    // Clear KV store before each test
    const keys = await env.DEPLOYS_KV.list();
    for (const key of keys.keys) {
      await env.DEPLOYS_KV.delete(key.name);
    }
  });

  describe('Basic CRUD operations', () => {
    it('should store and retrieve a model', async () => {
      const testData: TestModel = {
        id: 'test-1',
        name: 'Test Item',
        userId: '1',
        category: 'test-category',
      };

      await testModel.set(testData.id, testData);
      const retrieved = await testModel.get(testData.id);

      expect(retrieved).toEqual(testData);
    });

    it('should update an existing model', async () => {
      const testData: TestModel = {
        id: 'test-1',
        name: 'Test Item',
        userId: '1',
      };

      await testModel.set(testData.id, testData);
      await testModel.set(testData.id, { name: 'Updated Item' });

      const retrieved = await testModel.get(testData.id);
      expect(retrieved?.name).toBe('Updated Item');
      expect(retrieved?.userId).toBe('1');
    });

    it('should delete a model', async () => {
      const testData: TestModel = {
        id: 'test-1',
        name: 'Test Item',
        userId: '1',
      };

      await testModel.set(testData.id, testData);
      await testModel.delete(testData.id);

      const retrieved = await testModel.get(testData.id);
      expect(retrieved).toBeNull();
    });

    it('should validate model data', async () => {
      const invalidData = {
        id: 'test-1',
        // missing required 'name' field
        userId: '1',
      };

      await expect(
        testModel.set(invalidData.id, invalidData as TestModel)
      ).rejects.toThrow();
    });
  });

  describe('Unique index constraints', () => {
    it('should find model by unique index', async () => {
      const testData: TestModel = {
        id: 'test-1',
        name: 'Test Item',
        userId: '1',
      };

      await testModel.set(testData.id, testData);
      const found = await testModel.findByUserId('1');

      expect(found).toEqual(testData);
    });

    it('should prevent duplicate unique index values', async () => {
      const testData1: TestModel = {
        id: 'test-1',
        name: 'Test Item 1',
        userId: '1',
      };

      const testData2: TestModel = {
        id: 'test-2',
        name: 'Test Item 2',
        userId: '1', // Same userId - should violate unique constraint
      };

      await testModel.set(testData1.id, testData1);
      
      await expect(
        testModel.set(testData2.id, testData2)
      ).rejects.toThrow('Unique constraint violation');
    });

    it('should allow updating a model with the same unique index value', async () => {
      const testData: TestModel = {
        id: 'test-1',
        name: 'Test Item',
        userId: '1',
      };

      await testModel.set(testData.id, testData);
      
      // Should not throw when updating the same record
      await expect(
        testModel.set(testData.id, { name: 'Updated Name' })
      ).resolves.not.toThrow();

      const retrieved = await testModel.get(testData.id);
      expect(retrieved?.name).toBe('Updated Name');
    });

    it('should update index when unique field changes', async () => {
      const testData: TestModel = {
        id: 'test-1',
        name: 'Test Item',
        userId: '1',
      };

      await testModel.set(testData.id, testData);
      
      // Change userId
      await testModel.set(testData.id, { userId: '2' });

      // Old index should not find it
      const foundOld = await testModel.findByUserId('1');
      expect(foundOld).toBeNull();

      // New index should find it
      const foundNew = await testModel.findByUserId('2');
      expect(foundNew?.id).toBe(testData.id);
      expect(foundNew?.userId).toBe('2');
    });
  });

  describe('List index operations', () => {
    it('should find multiple models by list index', async () => {
      const models: TestModel[] = [
        { id: 'test-1', name: 'Item 1', userId: '1', category: 'electronics' },
        { id: 'test-2', name: 'Item 2', userId: '2', category: 'electronics' },
        { id: 'test-3', name: 'Item 3', userId: '3', category: 'books' },
      ];

      for (const model of models) {
        await testModel.set(model.id, model);
      }

      const electronics = await testModel.findByCategory('electronics');
      expect(electronics).toHaveLength(2);
      expect(electronics.map(e => e.id).sort()).toEqual(['test-1', 'test-2']);

      const books = await testModel.findByCategory('books');
      expect(books).toHaveLength(1);
      expect(books[0].id).toBe('test-3');
    });

    it('should handle empty list index results', async () => {
      const results = await testModel.findByCategory('nonexistent');
      expect(results).toEqual([]);
    });

    it('should update list index when category changes', async () => {
      const testData: TestModel = {
        id: 'test-1',
        name: 'Test Item',
        userId: '1',
        category: 'electronics',
      };

      await testModel.set(testData.id, testData);
      
      // Change category
      await testModel.set(testData.id, { category: 'books' });

      const electronics = await testModel.findByCategory('electronics');
      expect(electronics).toHaveLength(0);

      const books = await testModel.findByCategory('books');
      expect(books).toHaveLength(1);
      expect(books[0].id).toBe(testData.id);
    });
  });

  describe('Type coercion tests', () => {
    it('should handle numeric userId consistently', async () => {
      const testData: TestModel = {
        id: 'test-1',
        name: 'Test Item',
        userId: '1',
      };

      await testModel.set(testData.id, testData);

      // Test finding with number
      const foundByNumber = await testModel.findByUserId(1);
      expect(foundByNumber).toEqual(testData);

      // Test finding with string
      const foundByString = await testModel.findByUserId('1');
      expect(foundByString).toEqual(testData);
    });

    it('should store consistent index keys regardless of input type', async () => {
      const testData1: TestModel = {
        id: 'test-1',
        name: 'Test Item 1',
        userId: '123',
      };

      await testModel.set(testData1.id, testData1);

      // Verify the actual KV key stored
      const indexKey = 'index:test:userId:123';
      const storedId = await env.DEPLOYS_KV.get(indexKey);
      expect(storedId).toBe('test-1');

      // Try to create another with numeric user ID
      const testData2: TestModel = {
        id: 'test-2',
        name: 'Test Item 2',
        userId: '123', // Same value, should conflict
      };

      await expect(
        testModel.set(testData2.id, testData2)
      ).rejects.toThrow('Unique constraint violation');
    });
  });

  describe('KV storage verification', () => {
    it('should store correct keys and values in KV', async () => {
      const testData: TestModel = {
        id: 'test-1',
        name: 'Test Item',
        userId: '1',
        category: 'electronics',
      };

      await testModel.set(testData.id, testData);

      // Check main record
      const mainKey = 'test:test-1';
      const mainValue = await env.DEPLOYS_KV.get(mainKey);
      expect(JSON.parse(mainValue!)).toEqual(testData);

      // Check unique index
      const uniqueIndexKey = 'index:test:userId:1';
      const uniqueIndexValue = await env.DEPLOYS_KV.get(uniqueIndexKey);
      expect(uniqueIndexValue).toBe('test-1');

      // Check list index
      const listIndexKey = 'list:test:category:electronics';
      const listIndexValue = await env.DEPLOYS_KV.get(listIndexKey);
      expect(JSON.parse(listIndexValue!)).toEqual(['test-1']);
    });

    it('should clean up indexes on delete', async () => {
      const testData: TestModel = {
        id: 'test-1',
        name: 'Test Item',
        userId: '1',
        category: 'electronics',
      };

      await testModel.set(testData.id, testData);
      await testModel.delete(testData.id);

      // Check all keys are deleted
      const mainKey = 'test:test-1';
      const uniqueIndexKey = 'index:test:userId:1';
      const listIndexKey = 'list:test:category:electronics';

      expect(await env.DEPLOYS_KV.get(mainKey)).toBeNull();
      expect(await env.DEPLOYS_KV.get(uniqueIndexKey)).toBeNull();
      expect(await env.DEPLOYS_KV.get(listIndexKey)).toBeNull();
    });
  });

  describe('findOrCreateByIndex', () => {
    it('should return existing record if found', async () => {
      const existing: TestModel = {
        id: 'test-1',
        name: 'Existing Item',
        userId: '1',
      };

      await testModel.set(existing.id, existing);

      const result = await testModel.findOrCreateByIndex(
        'userId',
        '1',
        () => ({
          id: 'test-2',
          name: 'New Item',
          userId: '1',
        })
      );

      expect(result.id).toBe('test-1');
      expect(result.name).toBe('Existing Item');
    });

    it('should create new record if not found', async () => {
      const result = await testModel.findOrCreateByIndex(
        'userId',
        '1',
        () => ({
          id: 'test-1',
          name: 'New Item',
          userId: '1',
        })
      );

      expect(result.id).toBe('test-1');
      expect(result.name).toBe('New Item');

      // Verify it was stored
      const retrieved = await testModel.get('test-1');
      expect(retrieved).toEqual(result);
    });

    it('should handle async create function', async () => {
      const result = await testModel.findOrCreateByIndex(
        'userId',
        '1',
        async () => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            id: 'test-1',
            name: 'Async Item',
            userId: '1',
          };
        }
      );

      expect(result.name).toBe('Async Item');
    });
  });
});