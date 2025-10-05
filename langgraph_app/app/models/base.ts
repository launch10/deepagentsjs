import { z } from "zod";
import { eq, and, or, SQL, sql, inArray, type InferSelectModel, type InferInsertModel, desc } from 'drizzle-orm';
import { PgTable, type TableConfig, PgView, type ViewConfig, type PgTransaction } from 'drizzle-orm/pg-core';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '@db';

// Define types for tables and views
type TableWithId = PgTable<TableConfig> & {
  id: any;
};

type ReadOnlyView = PgView<ViewConfig>;

// Union type for anything that can be read from
type ReadableEntity = TableWithId | ReadOnlyView;

// Type for database connection (can be main db or transaction)
type DbConnection = PostgresJsDatabase<any> | PgTransaction<any, any, any>;

type WhereCondition<T extends ReadableEntity> = SQL<unknown> | ((entity: T) => SQL<unknown>);

type SelectModel<T extends ReadableEntity> = InferSelectModel<T>;
type InsertModel<T extends TableWithId> = InferInsertModel<T>;

// Base class for read-only operations (works with both tables and views)
export abstract class BaseView<Entity extends ReadableEntity, Schema extends z.ZodSchema> {
  protected data: z.infer<Schema>;
  protected static entity: ReadableEntity;
  protected static schema: z.ZodSchema;

  constructor(data: z.infer<Schema>) {
    this.data = data;
  }

  /**
   * Get the database table name from the entity
   */
  public static getTableName(): string | undefined {
    if (!this.entity) return undefined;
    
    // Try to get the table name from Drizzle's internal symbols
    const symbols = Object.getOwnPropertySymbols(this.entity);
    for (const sym of symbols) {
      const symStr = sym.toString();
      if (symStr.includes('Name')) {
        const value = (this.entity as any)[sym];
        if (typeof value === 'string') {
          return value;
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Static method to validate schema alignment without instantiating
   * Useful for testing or initialization checks
   * @param ignoredColumns - Optional list of columns to ignore during validation
   */
  public static validateSchema(ignoredColumns: string[] = []): void {
    if (!this.entity || !this.schema) {
      return;
    }

    const instance = Object.create(this.prototype);
    instance.constructor = this;
    
    const tableName = instance.getTableName();
    const schemaColumns = instance.getZodSchemaKeys(this.schema);
    let tableColumns = instance.getTableColumns(this.entity);
    
    // Filter out ignored columns
    if (ignoredColumns.length > 0) {
      tableColumns = tableColumns.filter(col => !ignoredColumns.includes(col));
    }
    
    const missingInSchema = tableColumns.filter(col => !schemaColumns.includes(col));
    const extraInSchema = schemaColumns.filter(col => !tableColumns.includes(col));
    
    if (missingInSchema.length > 0 || extraInSchema.length > 0) {
      instance.throwSchemaMismatchError(tableName, missingInSchema, extraInSchema, tableColumns, schemaColumns, ignoredColumns);
    }
  }


  /**
   * Get the table/view name for error messages
   */
  protected getTableName(): string {
    const ModelClass = this.constructor as typeof BaseView;
    // Try to get the table name from the entity Symbol description or use constructor name
    const entitySymbol = Object.getOwnPropertySymbols(ModelClass.entity).find(
      sym => sym.toString().includes('Symbol')
    );
    
    if (entitySymbol) {
      const match = entitySymbol.toString().match(/Symbol\(([^)]+)\)/);
      if (match) return match[1];
    }
    
    return this.constructor.name.replace('Model', '');
  }

  /**
   * Extract column names from a Drizzle table/view definition
   */
  protected getTableColumns(entity: ReadableEntity): string[] {
    const columns: string[] = [];
    
    for (const key in entity) {
      // Skip internal Drizzle properties (they start with _ or are Symbols)
      if (key.startsWith('_') || typeof entity[key] === 'symbol') {
        continue;
      }
      
      // Check if it's a column definition (has a name property or is a column object)
      const value = entity[key];
      if (value && typeof value === 'object') {
        // Check if it has column-like properties
        if ('name' in value || 'dataType' in value || 'columnType' in value) {
          columns.push(key);
        }
      }
    }
    
    return columns;
  }

  /**
   * Extract keys from a Zod schema
   */
  protected getZodSchemaKeys(schema: z.ZodSchema): string[] {
    // Handle different Zod schema types
    if (schema instanceof z.ZodObject) {
      return Object.keys(schema.shape);
    }
    
    // If it's a wrapped schema (like z.lazy, z.union, etc.), try to unwrap it
    if ('_def' in schema) {
      const def = (schema as any)._def;
      
      if (def.typeName === 'ZodLazy') {
        // For lazy schemas, we need to evaluate the getter
        const innerSchema = def.getter();
        return this.getZodSchemaKeys(innerSchema);
      }
      
      if (def.typeName === 'ZodUnion' || def.typeName === 'ZodDiscriminatedUnion') {
        // For unions, get keys from all options and combine them
        const allKeys = new Set<string>();
        for (const option of def.options || def.optionsMap?.values() || []) {
          this.getZodSchemaKeys(option).forEach(key => allKeys.add(key));
        }
        return Array.from(allKeys);
      }
      
      if (def.typeName === 'ZodEffects') {
        // For refined/transformed schemas
        return this.getZodSchemaKeys(def.schema);
      }
    }
    
    // If we can't determine the keys, return empty array (will be caught in validation)
    return [];
  }

  /**
   * Throw a detailed error about schema mismatches
   */
  protected throwSchemaMismatchError(
    tableName: string,
    missingInSchema: string[],
    extraInSchema: string[],
    tableColumns: string[],
    schemaColumns: string[],
    ignoredColumns: string[] = []
  ): void {
    const modelName = this.constructor.name;
    let errorMessage = `\n${'='.repeat(60)}\n`;
    errorMessage += `SCHEMA MISMATCH: ${modelName}\n`;
    errorMessage += `${'='.repeat(60)}\n\n`;
    
    if (ignoredColumns.length > 0) {
      errorMessage += `IGNORED COLUMNS: ${ignoredColumns.join(', ')}\n\n`;
    }
    
    if (missingInSchema.length > 0) {
      errorMessage += `DATABASE TABLE has these columns that SCHEMA is MISSING:\n`;
      missingInSchema.forEach(col => {
        errorMessage += `   • ${col} (exists in DB table, missing in Zod schema)\n`;
      });
      errorMessage += '\n';
    }
    
    if (extraInSchema.length > 0) {
      errorMessage += `ZOD SCHEMA has these fields that DATABASE TABLE doesn't have:\n`;
      extraInSchema.forEach(col => {
        errorMessage += `   • ${col} (exists in Zod schema, missing in DB table)\n`;
      });
      errorMessage += '\n';
    }
    
    errorMessage += `TO FIX:\n`;
    
    if (missingInSchema.length > 0) {
      errorMessage += `   1. ADD these to your Zod schema: ${missingInSchema.join(', ')}\n`;
    }
    
    if (extraInSchema.length > 0) {
      errorMessage += `   2. REMOVE these from your Zod schema: ${extraInSchema.join(', ')}\n`;
    }
    
    errorMessage += `\n${'='.repeat(60)}\n`;
    
    throw new Error(errorMessage);
  }

  protected static getEntity<T extends ReadableEntity>(this: typeof BaseView & { entity: T }): T {
    return this.entity;
  }

  protected static getSchema<S extends z.ZodSchema>(this: typeof BaseView & { schema: S }): S {
    return this.schema;
  }

  public static isValid<S extends z.ZodSchema>(
    this: typeof BaseView & { schema: S },
    data: unknown
  ): data is z.infer<S> {
    return this.schema.safeParse(data).success;
  }

  public toDataObject(): z.infer<Schema> {
    return this.schema.parse(this.data);
  }

  static normalize(obj: any): any {
    return obj;
  }

  protected static normalizeOutput(obj: any): any {
    return obj;
  }

  // Helper method to build where conditions from an object
  protected static buildWhereConditions(conditions: Partial<any>): SQL<unknown>[] {
    return Object.entries(conditions)
      .filter(([_, value]) => value !== undefined) // Filter out undefined values
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return inArray((this.entity as any)[key], value);
        }
        return eq((this.entity as any)[key], value);
      });
  }

  static async last(tx: DbConnection = db) {
    return (await tx.select().from(this.entity as any).orderBy(desc(this.entity.id)).limit(1))[0];
  }

  // Read-only methods
  static async findBy(
    conditions: Partial<any>,
    tx: DbConnection = db
  ): Promise<any | null> {
    const whereConditions = this.buildWhereConditions(conditions);
    
    let result;
    try {
      result = await tx
        .select()
        .from(this.entity as any)
        .where(and(...whereConditions))
        .limit(1);
    } catch (error) {
      return null;
    }
    
    const converted = this.normalizeOutput(result[0]);
    return converted || null;
  }

  static async where(
    conditions: Partial<any> | SQL<unknown> | ((entity: any) => SQL<unknown>),
    tx: DbConnection = db
  ): Promise<any[]> {
    let whereClause: SQL<unknown>;
    
    if (typeof conditions === 'function') {
      whereClause = conditions(this.entity);
    } else if (conditions instanceof SQL) {
      whereClause = conditions;
    } else {
      // Handle object conditions
      const whereConditions = this.buildWhereConditions(conditions);
      whereClause = and(...whereConditions) as SQL<unknown>;
    }
    
    const result = await tx
      .select()
      .from(this.entity as any)
      .where(whereClause);
    
    return this.normalizeOutput(result);
  }

  static async all(tx: DbConnection = db): Promise<any[]> {
    const result = await tx.select().from(this.entity as any);
    return this.normalizeOutput(result);
  }

  static async count(
    conditions?: Partial<any>,
    tx: DbConnection = db
  ): Promise<number> {
    let query = tx
      .select({ count: sql`count(*)` })
      .from(this.entity as any);
    
    if (conditions) {
      const whereConditions = this.buildWhereConditions(conditions);
      query = query.where(and(...whereConditions)) as any;
    }
    
    const result = await query;
    return Number(result[0].count);
  }

  // Query builder method for chaining
  static query(tx: DbConnection = db) {
    return tx.select().from(this.entity as any);
  }
}

// Extended class for full CRUD operations (only works with tables)
export abstract class BaseModel<Table extends TableWithId, Schema extends z.ZodSchema> extends BaseView<Table, Schema> {
  // Override entity to be called table for backwards compatibility
  protected static table: TableWithId;
  protected static defaultScope: Record<string, any> = {};
  
  // Make entity point to table for BaseView methods
  protected static get entity() {
    return this.table;
  }

  // Helper to merge default scope with conditions
  protected static mergeWithDefaultScope(conditions: Record<string, any> = {}): Record<string, any> {
    return { ...this.defaultScope, ...conditions };
  }

  protected static getTable<T extends TableWithId>(this: typeof BaseModel & { table: T }): T {
    return this.table;
  }

  // Override query methods to apply defaultScope
  static async findBy(
    conditions: Record<string, any>,
    tx: DbConnection = db
  ): Promise<any | null> {
    return super.findBy(this.mergeWithDefaultScope(conditions), tx);
  }

  static async where(
    conditions: Record<string, any> | SQL<unknown> | ((entity: any) => SQL<unknown>),
    tx: DbConnection = db
  ): Promise<any[]> {
    if (typeof conditions === 'object' && !(conditions instanceof SQL)) {
      return super.where(this.mergeWithDefaultScope(conditions), tx);
    }
    // For SQL or function conditions, we can't easily merge defaultScope
    // User must include scope manually in these cases
    return super.where(conditions, tx);
  }

  static async all(tx: DbConnection = db): Promise<any[]> {
    if (Object.keys(this.defaultScope).length > 0) {
      return super.where(this.defaultScope, tx);
    }
    return super.all(tx);
  }

  static async count(
    conditions: Record<string, any> = {},
    tx: DbConnection = db
  ): Promise<number> {
    return super.count(this.mergeWithDefaultScope(conditions), tx);
  }

  // Table-specific methods (with id field)
  static async find(
    id: number | string,
    tx: DbConnection = db
  ): Promise<any | null> {
    let result;
    try {
      const whereConditions = [eq(this.table.id, id)];
      
      // Add default scope conditions if they exist
      if (Object.keys(this.defaultScope).length > 0) {
        const scopeConditions = this.buildWhereConditions(this.defaultScope);
        whereConditions.push(...scopeConditions);
      }
      
      result = await tx
        .select()
        .from(this.table as any)
        .where(and(...whereConditions))
        .limit(1);
    } catch (error) {
      return null;
    }
    
    const converted = this.normalizeOutput(result[0]);
    return converted || null;
  }


  // Write operations
  static async create(
    data: any,
    tx: DbConnection = db
  ): Promise<any> {
    const now = new Date().toISOString();
    const dataWithScope = { 
      ...this.defaultScope, 
      ...data,
      // Only set timestamps if the table has these columns and they're not already set
      ...('createdAt' in this.table && !data.createdAt ? { createdAt: now } : {}),
      ...('updatedAt' in this.table && !data.updatedAt ? { updatedAt: now } : {})
    };
    const result = await tx
      .insert(this.table)
      .values(dataWithScope)
      .returning();
    
    return this.normalizeOutput(result[0]);
  }

  static async createMany(
    data: any[],
    tx: DbConnection = db
  ): Promise<any[]> {
    const now = new Date().toISOString();
    const dataWithScope = data.map(item => ({ 
      ...this.defaultScope, 
      ...item,
      // Only set timestamps if the table has these columns and they're not already set
      ...('createdAt' in this.table && !item.createdAt ? { createdAt: now } : {}),
      ...('updatedAt' in this.table && !item.updatedAt ? { updatedAt: now } : {})
    }));
    const result = await tx
      .insert(this.table)
      .values(dataWithScope)
      .returning();
    
    return this.normalizeOutput(result);
  }

  static async update(
    id: number | string,
    data: Partial<any>,
    tx: DbConnection = db
  ): Promise<any | null> {
    const result = await tx
      .update(this.table)
      .set(data)
      .where(eq(this.table.id, id))
      .returning();
    
    const converted = this.normalizeOutput(result[0]);
    return converted || null;
  }

  static async updateWhere(
    conditions: Partial<any>,
    data: Partial<any>,
    tx: DbConnection = db
  ): Promise<any[]> {
    const conditionsWithScope = this.mergeWithDefaultScope(conditions);
    const whereConditions = this.buildWhereConditions(conditionsWithScope);
    
    const result = await tx
      .update(this.table)
      .set(data)
      .where(and(...whereConditions))
      .returning();
    
    return this.normalizeOutput(result);
  }

  static async destroy(
    id: number | string,
    tx: DbConnection = db
  ): Promise<boolean> {
    const result = await tx
      .delete(this.table)
      .where(eq(this.table.id, id))
      .returning();
    
    return result.length > 0;
  }

  static async destroyWhere(
    conditions: Partial<any>,
    tx: DbConnection = db
  ): Promise<number> {
    const conditionsWithScope = this.mergeWithDefaultScope(conditions);
    const whereConditions = this.buildWhereConditions(conditionsWithScope);
    
    const result = await tx
      .delete(this.table)
      .where(and(...whereConditions))
      .returning();
    
    return result.length;
  }

  /**
   * Define associations for this model
   * Override in subclasses to specify both belongsTo and hasMany relations
   * 
   * Example:
   * {
   *   belongsTo: {
   *     component: { table: components, foreignKey: 'componentId', nameField: 'name' },
   *     fileSpecification: { table: fileSpecifications, foreignKey: 'fileSpecificationId', nameField: 'name' }
   *   },
   *   hasMany: {
   *     tasks: { table: tasks, foreignKey: 'componentId' }
   *   }
   * }
   */
  protected static associations(): {
    belongsTo?: Record<string, { table: any; foreignKey: string; nameField?: string }>;
    hasMany?: Record<string, { table: any; foreignKey: string }>;
  } {
    return {};
  }


  /**
   * Build an in-memory object without persisting
   * Uses the schema to validate and provide defaults
   */
  static build<S extends z.ZodSchema>(
    this: typeof BaseModel & { schema: S },
    params: Partial<z.infer<S>> = {}
  ): z.infer<S> {
    // If there's a factory function defined, use it
    // Otherwise just validate with the schema
    return this.schema.parse(params);
  }

  /**
   * Build with association lookups
   * Converts names to IDs using the association map
   */
  static async buildWith<S extends z.ZodSchema>(
    this: typeof BaseModel & { schema: S },
    params: Record<string, any> = {},
    tx: DbConnection = db
  ): Promise<z.infer<S>> {
    const resolved = await this.resolveAssociations(params, tx);
    return this.build(resolved);
  }

  /**
   * Resolve association objects to foreign key IDs
   * Handles: 
   * - Objects with id field -> extracts the id
   * - String lookups using nameField -> queries the database
   */
  protected static async resolveAssociations(
    params: Record<string, any>,
    tx: DbConnection = db
  ): Promise<Record<string, any>> {
    const resolved = { ...params };
    const assoc = this.associations();

    if (!assoc.belongsTo) return resolved;

    // Process belongsTo associations
    for (const [name, config] of Object.entries(assoc.belongsTo)) {
      // Check if this association field exists in params
      if (params[name] !== undefined) {
        const value = params[name];
        
        // If it's an object with an id, use the id
        if (typeof value === 'object' && value !== null && 'id' in value) {
          resolved[config.foreignKey] = Number(value.id);
          delete resolved[name];
        }
        // If it's a string and we have a nameField, do a lookup
        else if (typeof value === 'string' && config.nameField) {
          try {
            const results = await tx.select()
              .from(config.table)
              .where(eq(config.table[config.nameField], value))
              .limit(1);
            
            if (results && results.length > 0) {
              resolved[config.foreignKey] = Number(results[0].id);
            }
          } catch (error) {
            console.warn(`Failed to resolve ${name}:`, error);
          }
          delete resolved[name];
        }
      }
      
      // Also check for explicit name pattern (e.g., componentName)
      const nameKey = `${name}Name`;
      if (params[nameKey] !== undefined && config.nameField) {
        try {
          const results = await tx.select()
            .from(config.table)
            .where(eq(config.table[config.nameField], params[nameKey]))
            .limit(1);
          
          if (results && results.length > 0) {
            resolved[config.foreignKey] = Number(results[0].id);
          }
        } catch (error) {
          console.warn(`Failed to resolve ${nameKey}:`, error);
        }
        delete resolved[nameKey];
      }
    }

    return resolved;
  }

  /**
   * Create with association lookups
   * Converts names to IDs and then persists
   */
  static async createWith<T extends TableWithId>(
    this: typeof BaseModel & { table: T },
    params: Record<string, any>,
    tx: DbConnection = db
  ): Promise<SelectModel<T>> {
    const resolved = await this.resolveAssociations(params, tx);
    return this.create(resolved as InsertModel<T>, tx);
  }

  /**
   * Find or build with defaults
   */
  static async findOrInitializeBy<T extends TableWithId>(
    this: typeof BaseView & { entity: T },
    conditions: Partial<SelectModel<T>>,
    defaults: Partial<InsertModel<T>> = {},
    tx: DbConnection = db
  ): Promise<SelectModel<T>> {
    const existing = await this.findBy(conditions, tx);
    if (existing) return existing;

    const merged = { ...conditions, ...defaults };
    return this.buildWith(merged as Record<string, any>, tx);
  }

  /**
   * Find or create with defaults
   */
  static async findOrCreateBy<T extends TableWithId>(
    this: typeof BaseModel & { table: T },
    conditions: Partial<SelectModel<T>>,
    defaults: Partial<InsertModel<T>> = {},
    tx: DbConnection = db
  ): Promise<SelectModel<T>> {
    const existing = await this.findBy(conditions, tx);
    if (existing) return existing;
    
    return this.create({ ...defaults, ...conditions } as InsertModel<T>, tx);
  }

  /**
   * Find or create with association lookups
   */
  static async findOrCreateWith<T extends TableWithId>(
    this: typeof BaseModel & { table: T },
    params: Record<string, any>,
    defaults: Record<string, any> = {},
    tx: DbConnection = db
  ): Promise<SelectModel<T>> {
    const resolvedConditions = await this.resolveAssociations(params, tx);
    const resolvedDefaults = await this.resolveAssociations(defaults, tx);
    
    const existing = await this.findBy(resolvedConditions as Partial<SelectModel<T>>, tx);
    if (existing) return existing;
    
    return this.create({ ...resolvedDefaults, ...resolvedConditions } as InsertModel<T>, tx);
  }

  /**
   * Load hasMany associations
   * Example: await ComponentModel.loadMany(component, 'tasks')
   */
  static async loadMany<T extends TableWithId>(
    this: typeof BaseModel & { table: T },
    record: SelectModel<T>,
    associationName: string,
    tx: DbConnection = db
  ): Promise<any[]> {
    const assoc = this.associations();
    if (!assoc.hasMany || !assoc.hasMany[associationName]) {
      throw new Error(`No hasMany association '${associationName}' defined`);
    }

    const config = assoc.hasMany[associationName];
    const results = await tx.select()
      .from(config.table)
      .where(eq(config.table[config.foreignKey], (record as any).id));
    
    return this.normalizeOutput(results);
  }

  /**
   * Load belongsTo association
   * Example: await TaskModel.loadBelongsTo(task, 'component')
   */
  static async loadBelongsTo<T extends TableWithId>(
    this: typeof BaseModel & { table: T },
    record: SelectModel<T>,
    associationName: string,
    tx: DbConnection = db
  ): Promise<any | null> {
    const assoc = this.associations();
    if (!assoc.belongsTo || !assoc.belongsTo[associationName]) {
      throw new Error(`No belongsTo association '${associationName}' defined`);
    }

    const config = assoc.belongsTo[associationName];
    const foreignKeyValue = (record as any)[config.foreignKey];
    
    if (!foreignKeyValue) return null;
    
    const [result] = await tx.select()
      .from(config.table)
      .where(eq(config.table.id, foreignKeyValue))
      .limit(1);
    
    return result ? this.normalizeOutput(result) : null;
  }
}

// Helper for SQL functions
export { sql, eq, and, or, inArray };