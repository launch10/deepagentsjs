import { serial, text, pgTable, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { themesToThemeLabels } from './themesToThemeLabels'; // Will be created next

export const themeLabel = pgTable('theme_labels', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // Label name (e.g., "professional", "modern")
}, (table) => {
  return {
    themeLabelNameIdx: uniqueIndex('theme_label_name_idx').on(table.name), // Ensure label names are unique
  };
});

// Relation: A label can be associated with many palettes through the join table
export const themeLabelRelations = relations(themeLabel, ({ many }) => ({
  themesToThemeLabels: many(themesToThemeLabels),
}));

export type ThemeLabel = typeof themeLabel.$inferSelect;
export type NewThemeLabel = typeof themeLabel.$inferInsert;