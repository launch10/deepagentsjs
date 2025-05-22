import { serial, text, timestamp, jsonb, pgTable, index, bigint, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { page } from './page'; // For relation
import { tenant } from './tenant'; // For relation
import { theme } from './theme'; // For relation

export const project = pgTable('projects', {
  id: serial('id').primaryKey(),
  projectName: text('project_name').notNull(),
  tenantId: bigint('tenant_id', { mode: 'number' }).notNull(),
  projectMode: text('project_mode').notNull(),
  projectPlan: jsonb('project_plan').notNull(),
  themeId: bigint('theme_id', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    themeIdIdx: index('projects_theme_id_idx').on(table.themeId),
    tenantIdIdx: index('projects_tenant_id_idx').on(table.tenantId),
    projectNameIdx: index('projects_project_name_idx').on(table.projectName),
    projectNameTenantUnique: unique('project_name_tenant_unique_idx').on(table.projectName, table.tenantId),
    createdAtIdx: index('projects_created_at_idx').on(table.createdAt),
    updatedAtIdx: index('projects_updated_at_idx').on(table.updatedAt),
  };
});

export const projectRelations = relations(project, ({ many, one }) => ({
  pages: many(page),
  tenant: one(tenant, {
    fields: [project.tenantId],
    references: [tenant.id],
  }),
  theme: one(theme, {
    fields: [project.themeId],
    references: [theme.id],
  }),
}));

export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;