import { serial, text, timestamp, integer, jsonb, pgTable, index, unique } from 'drizzle-orm/pg-core';

export const fileSpecification = pgTable('file_specifications', {
  id: serial('id').primaryKey(),
  canonicalPath: text('canonical_path').notNull(),
  description: text('description').notNull(),
  filetype: text('filetype').notNull(),
  subtype: text('subtype').notNull(), 
  language: text('language'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    filetypeIdx: index('file_specifications_filetype_idx').on(table.filetype),
    subtypeIdx: unique('file_specifications_subtype_idx').on(table.subtype),
    canonicalPathIdx: index('file_specifications_canonical_path_idx').on(table.canonicalPath),
  };
});

export type FileSpecification = typeof fileSpecification.$inferSelect;
export type NewFileSpecification = typeof fileSpecification.$inferInsert;