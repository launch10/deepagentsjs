import { integer, primaryKey, pgTable } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { theme } from './theme';
import { themeLabel } from './themeLabel';

export const themesToThemeLabels = pgTable(
  'themes_to_theme_labels',
  {
    themeId: integer('theme_id')
      .notNull(),
    labelId: integer('theme_label_id') // Renamed column
      .notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.themeId, t.labelId] }), // Composite primary key
  }),
);

// Define relations for the join table
export const themesToThemeLabelsRelations = relations(themesToThemeLabels, ({ one }) => ({
  theme: one(theme, {
    fields: [themesToThemeLabels.themeId],
    references: [theme.id],
  }),
  themeLabel: one(themeLabel, { // Use renamed table
    fields: [themesToThemeLabels.labelId],
    references: [themeLabel.id],
  }),
}));
