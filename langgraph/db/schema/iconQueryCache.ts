import { pgTable, serial, text, timestamp, jsonb, index, integer, real } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

export const iconQueryCache = pgTable('icon_query_cache', {
  id: serial('id').primaryKey(),
  query: text('query').notNull(),
  results: jsonb('results').notNull(), // Array of icon keys with their similarity scores
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
  useCount: integer('use_count').notNull().default(1),
  ttlSeconds: integer('ttl_seconds').notNull().default(86400), // 24 hours by default
  minSimilarity: real('min_similarity').notNull().default(0.7), // Minimum similarity score for the results to be cached
  topK: integer('top_k').notNull(), // Store the number of results we cached
}, (table) => ({
  queryIdx: index('icon_query_cache_query_idx').on(table.query)
}));

export const iconQueryCacheSchema = createInsertSchema(iconQueryCache);
