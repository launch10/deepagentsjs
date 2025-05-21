import { serial, text, timestamp, jsonb, pgTable, index, integer, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { page } from './page'; // For one-to-many relation with page
import { project } from './project'; // For one-to-many relation with project
import { file } from './file'; // For one-to-many relation with file

export const section = pgTable('sections', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  pageId: integer('page_id').notNull(),
  componentId: text('component_id').notNull(),
  sectionType: text('section_type').notNull(),
  fileId: integer('file_id').notNull(),
  contentPlan: jsonb('content_plan').notNull(),
  theme: jsonb('theme').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => {
  return {
    pageIdIdx: index('sections_page_id_idx').on(table.pageId),
    componentIdIdx: index('sections_component_id_idx').on(table.componentId),
    sectionTypeIdx: index('sections_section_type_idx').on(table.sectionType),
    fileIdIdx: index('sections_file_id_idx').on(table.fileId),
    pageComponentIdIdx: index('sections_page_component_id_idx').on(table.pageId, table.componentId),
    sectionPageComponentUniqueIdx: unique('section_page_component_unique_idx').on(table.pageId, table.componentId),
  };
});

export const sectionRelations = relations(section, ({ one }) => ({
  page: one(page, {
    fields: [section.pageId],
    references: [page.id],
  }),
  file: one(file, {
    fields: [section.fileId],
    references: [file.id],
  }),
}));

export type Section = typeof section.$inferSelect;
export type NewSection = typeof section.$inferInsert;