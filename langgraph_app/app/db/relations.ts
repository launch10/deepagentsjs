import { relations } from "drizzle-orm/relations";
import {
  accounts,
  accountUsers,
  componentContentPlans,
  componentOverviews,
  components,
  contentStrategies,
  fileSpecifications,
  pages,
  projects,
  tasks,
  templateFiles,
  templates,
  themes,
  themeLabels,
  themeVariants,
  themesToThemeLabels,
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

export const componentContentPlansRelations = relations(componentContentPlans, ({ one }) => ({
  component: one(components, {
    fields: [componentContentPlans.componentId],
    references: [components.id],
  }),
  componentOverview: one(componentOverviews, {
    fields: [componentContentPlans.componentOverviewId],
    references: [componentOverviews.id],
  }),
}));

export const componentOverviewsRelations = relations(componentOverviews, ({ one }) => ({
  component: one(components, {
    fields: [componentOverviews.componentId],
    references: [components.id],
  }),
  website: one(websites, {
    fields: [componentOverviews.websiteId],
    references: [websites.id],
  }),
  fileSpecification: one(fileSpecifications, {
    fields: [componentOverviews.fileSpecificationId],
    references: [fileSpecifications.id],
  }),
}));

export const componentsRelations = relations(components, ({ one, many }) => ({
  componentContentPlans: many(componentContentPlans),
  componentOverviews: many(componentOverviews),
  website: one(websites, {
    fields: [components.websiteId],
    references: [websites.id],
  }),
  page: one(pages, {
    fields: [components.pageId],
    references: [pages.id],
  }),
}));

export const contentStrategiesRelations = relations(contentStrategies, ({ one }) => ({
  website: one(websites, {
    fields: [contentStrategies.websiteId],
    references: [websites.id],
  }),
}));

export const pagesRelations = relations(pages, ({ one }) => ({
  website: one(websites, {
    fields: [pages.websiteId],
    references: [websites.id],
  }),
  websiteFile: one(websiteFiles, {
    fields: [pages.websiteFileId],
    references: [websiteFiles.id],
  }),
  fileSpecification: one(fileSpecifications, {
    fields: [pages.fileSpecificationId],
    references: [fileSpecifications.id],
  }),
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
  fileSpecification: one(fileSpecifications, {
    fields: [tasks.fileSpecificationId],
    references: [fileSpecifications.id],
  }),
  component: one(components, {
    fields: [tasks.componentId],
    references: [components.id],
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
  pages: many(pages),
  websiteFiles: many(websiteFiles),
}));
