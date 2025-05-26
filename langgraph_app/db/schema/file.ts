import { serial, text, timestamp, integer, jsonb, pgTable, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { project } from './project'; // For one-to-many relation with project
import { section } from './section'; // For one-to-many relation with section
import { page } from './page'; // For one-to-many relation with page
import { fileSpecification } from './fileSpecification'; // For one-to-many relation with fileSpecification

export const file = pgTable('files', {
  id: serial('id').primaryKey(),
  path: text('path').notNull(),
  content: text('content').notNull(),
  fileSpecificationId: integer('file_specification_id'),
  projectId: integer('project_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    projectIdIdx: index('files_project_id_idx').on(table.projectId),
    pathProjectIdIdx: unique('files_path_project_id_unique_idx').on(table.path, table.projectId),
    fileSpecificationIdIdx: index('files_file_specification_id_idx').on(table.fileSpecificationId),
  };
});

export const fileRelations = relations(file, ({ one, many }) => ({
  project: one(project, {
    fields: [file.projectId],
    references: [project.id],
  }),
  sections: many(section),
  pages: many(page),
  fileSpecification: one(fileSpecification, {
    fields: [file.fileSpecificationId],
    references: [fileSpecification.id],
  }),
}));

export type File = typeof file.$inferSelect;
export type NewFile = typeof file.$inferInsert;