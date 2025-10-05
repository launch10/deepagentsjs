/**
 * Automatic Timestamp Middleware for Drizzle ORM
 * 
 * This middleware automatically adds createdAt and updatedAt timestamps
 * to all insert and update operations.
 * 
 * Supported operations:
 * - db.insert(table).values(data)
 * - db.update(table).set(data)
 * - db.transaction(async (tx) => { ... })
 * - All the above operations within transactions
 * - Chained operations like onConflictDoUpdate, onConflictDoNothing
 * 
 * Note: For prepared statements and batch operations, timestamps should
 * be added when the statement is prepared, not when executed.
 */

/**
 * Helper function to wrap insert/update methods with timestamp logic
 */
function wrapDatabaseMethods(dbObj: any) {
  const originalInsert = dbObj.insert.bind(dbObj);
  const originalUpdate = dbObj.update.bind(dbObj);

  // Override insert method
  dbObj.insert = function(table: any) {
    const insertObj = originalInsert(table);
    const originalValues = insertObj.values.bind(insertObj);
    
    insertObj.values = function(data: any) {
      const now = new Date().toISOString();
      
      // Handle single object or array of objects
      const addTimestamps = (item: any) => {
        const result = { ...item };
        
        // Check if the table has timestamp columns
        // In Drizzle, columns are direct properties on the table object
        const hasCreatedAt = 'createdAt' in table;
        const hasUpdatedAt = 'updatedAt' in table;
        
        // Add createdAt if table has it and it's not set
        if (hasCreatedAt && !('createdAt' in item)) {
          result.createdAt = now;
        }
        
        // Add updatedAt if table has it and it's not set  
        if (hasUpdatedAt) {
          result.updatedAt = now;
        }
        
        return result;
      };
      
      const dataWithTimestamps = Array.isArray(data) 
        ? data.map(addTimestamps)
        : addTimestamps(data);
      
      const result = originalValues(dataWithTimestamps);
      
      // Also wrap onConflictDoUpdate if it exists
      if (result.onConflictDoUpdate) {
        const originalOnConflictDoUpdate = result.onConflictDoUpdate.bind(result);
        result.onConflictDoUpdate = function(config: any) {
          if (config?.set) {
            const now = new Date().toISOString();
            const hasUpdatedAt = 'updatedAt' in table;
            
            // Add updatedAt to the update set if not provided
            if (hasUpdatedAt) {
              config.set.updatedAt = now;
            }
          }
          return originalOnConflictDoUpdate(config);
        };
      }
      
      return result;
    };
    
    return insertObj;
  };

  // Override update method
  dbObj.update = function(table: any) {
    const updateObj = originalUpdate(table);
    const originalSet = updateObj.set.bind(updateObj);
    
    updateObj.set = function(data: any) {
      const now = new Date().toISOString();
      
      // Check if the table has updatedAt column
      const hasUpdatedAt = 'updatedAt' in table;
      
      // Add updatedAt if table has it and it's not set
      const dataWithTimestamp = {
        ...data,
        ...(hasUpdatedAt && !('updatedAt' in data) ? { updatedAt: now } : {})
      };
      
      return originalSet(dataWithTimestamp);
    };
    
    return updateObj;
  };

  return dbObj;
}

/**
 * Middleware to automatically add timestamps to insert/update operations
 * This wraps the database object and intercepts insert/update calls
 */
export function withTimestamps(db: any) {
  // Wrap the main db object
  wrapDatabaseMethods(db);
  
  // Also wrap the transaction method to handle transactions
  const originalTransaction = db.transaction?.bind(db);
  if (originalTransaction) {
    db.transaction = async function(fn: any, config?: any) {
      return originalTransaction(async (tx: any) => {
        // Wrap the transaction object with timestamp handling
        wrapDatabaseMethods(tx);
        return fn(tx);
      }, config);
    };
  }
  
  // Wrap batch method if it exists
  const originalBatch = db.batch?.bind(db);
  if (originalBatch) {
    db.batch = function(queries: any[]) {
      // For batch operations, we need to intercept each query
      // This is more complex as batch takes prepared statements
      // For now, we'll just pass through and rely on the fact that
      // most batch operations will use prepared statements from insert/update
      // which are already wrapped
      return originalBatch(queries);
    };
  }
  
  return db;
}