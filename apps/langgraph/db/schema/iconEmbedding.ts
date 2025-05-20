import { pgTable, serial, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const iconEmbedding = pgTable('icon_embeddings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  text: text('text').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  vectorIdx: index('icon_embedding_idx')
    .using('ivfflat', table.embedding.op('vector_cosine_ops'))
    .with({ lists: 100 }),
  textIdx: index('icon_text_idx').on(table.text)
}));

export const iconEmbeddingSchema = createInsertSchema(iconEmbedding);
export type IconEmbeddingSchema = z.infer<typeof iconEmbeddingSchema>;