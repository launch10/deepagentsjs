import { serial, text, timestamp, integer, jsonb, pgTable, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { project } from './project'; // For one-to-many relation with project
import { section } from './section'; // For one-to-many relation with section
import { file } from './file'; // For one-to-many relation with file

export const page = pgTable('pages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  projectId: integer('project_id').notNull(),
  fileId: integer('file_id').notNull(),
  pageType: text('page_type').notNull(), 
  contentPlan: jsonb('content_plan'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    projectIdIdx: index('pages_project_id_idx').on(table.projectId),
    pageTypeProjectIdIdx: unique('pages_page_type_project_id_unique_idx').on(table.pageType, table.projectId),
    fileIdIdx: index('pages_file_id_idx').on(table.fileId),
  };
});

export const pageRelations = relations(page, ({ one, many }) => ({
  project: one(project, {
    fields: [page.projectId],
    references: [project.id],
  }),
  sections: many(section),
  file: one(file, {
    fields: [page.fileId],
    references: [file.id],
  }),
}));
export type Page = typeof page.$inferSelect;
export type NewPage = typeof page.$inferInsert;