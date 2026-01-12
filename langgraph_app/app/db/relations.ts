import { relations } from "drizzle-orm/relations";
import {
  accounts,
  accountUsers,
  projects,
  tasks,
  templateFiles,
  templates,
  themes,
  themeLabels,
  websiteFiles,
  websites,
  users,
} from "./schema";

// TODO: Add proper foreign key constraints to auto-generate relations with drizzle,
// HOWEVER, we need to ensure we set deferrable constraints or something for db syncing
// CONSTRAINT posts_user_id_fk FOREIGN KEY (user_id)
// REFERENCES users(id)
// DEFERRABLE INITIALLY DEFERRED;
export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.ownerId],
    references: [users.id],
  }),
  accountUsers: many(accountUsers),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  accountUsers: many(accountUsers),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  account: one(accounts, {
    fields: [projects.accountId],
    references: [accounts.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  website: one(websites, {
    fields: [tasks.websiteId],
    references: [websites.id],
  }),
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
}));

export const templateFilesRelations = relations(templateFiles, ({ one }) => ({
  template: one(templates, {
    fields: [templateFiles.templateId],
    references: [templates.id],
  }),
}));

export const themesRelations = relations(themes, ({ one, many }) => ({
  themeLabels: many(themeLabels),
}));

export const websiteFilesRelations = relations(websiteFiles, ({ one }) => ({
  website: one(websites, {
    fields: [websiteFiles.websiteId],
    references: [websites.id],
  }),
}));

export const websitesRelations = relations(websites, ({ one, many }) => ({
  project: one(projects, {
    fields: [websites.projectId],
    references: [projects.id],
  }),
  account: one(accounts, {
    fields: [websites.accountId],
    references: [accounts.id],
  }),
  websiteFiles: many(websiteFiles),
}));
