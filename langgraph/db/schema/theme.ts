import { serial, text, timestamp, jsonb, pgTable, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { themesToThemeLabels } from './themesToThemeLabels';
import { project } from './project'; // For one-to-many relation

// Removed 'labels' array
export const theme = pgTable('themes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // Palette name (e.g., "Sunset Bliss")
  colors: jsonb('colors').notNull(), // JSON object with color definitions
  theme: jsonb('theme').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => {
  return {
    // Add unique index on name
    nameIdx: uniqueIndex('palette_name_idx').on(table.name),
  };
});

// Relation: A palette can have many labels through the join table
// And a palette can be used by many projects
export const themeRelations = relations(theme, ({ many }) => ({
  themesToThemeLabels: many(themesToThemeLabels),
  projects: many(project), // Palette has many projects
}));

export type Theme = typeof theme.$inferSelect;
export type NewTheme = typeof theme.$inferInsert;
