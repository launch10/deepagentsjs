// Inferred types from schema (keeps types synced with db:reflect)
// Use $inferSelect for "what you get back from DB queries"
import {
  websites,
  websiteFiles,
  websiteDeploys,
  projects,
  accounts,
  users,
  campaigns,
  templates,
  themes,
  brainstorms,
  chats,
  domains,
  adGroups,
  ads,
} from "./schema";

export type WebsiteType = typeof websites.$inferSelect;
export type WebsiteFileType = typeof websiteFiles.$inferSelect;
export type WebsiteDeployType = typeof websiteDeploys.$inferSelect;
export type ProjectType = typeof projects.$inferSelect;
export type AccountType = typeof accounts.$inferSelect;
export type UserType = typeof users.$inferSelect;
export type CampaignType = typeof campaigns.$inferSelect;
export type TemplateType = typeof templates.$inferSelect;
export type ThemeType = typeof themes.$inferSelect;
export type BrainstormType = typeof brainstorms.$inferSelect;
export type ChatType = typeof chats.$inferSelect;
export type DomainType = typeof domains.$inferSelect;
export type AdGroupType = typeof adGroups.$inferSelect;
export type AdType = typeof ads.$inferSelect;
