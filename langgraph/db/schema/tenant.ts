import { pgTable, bigserial, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { project } from './project'; // For one-to-many relation

export const tenant = pgTable('tenants', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    nameIdx: index('tenants_name_idx').on(table.name),
  };
});

export const tenantRelations = relations(tenant, ({ many }) => ({
  projects: many(project),
}));

export type Tenant = typeof tenant.$inferSelect;
export type NewTenant = typeof tenant.$inferInsert;
