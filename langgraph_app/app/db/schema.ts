import { pgTable, index, foreignKey, bigserial, varchar, bigint, boolean, timestamp, text, integer, uniqueIndex, jsonb, vector, doublePrecision, serial, numeric, pgView, pgSequence , customType} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// Custom type for PostgreSQL tsvector
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});

// Custom type for PostgreSQL bytea
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const accountRequestCountsIdSeq = pgSequence("account_request_counts_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })
export const domainRequestCountsIdSeq = pgSequence("domain_request_counts_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })
export const userRequestCountsIdSeq = pgSequence("user_request_counts_id_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })

export const accounts = pgTable("accounts", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ownerId: bigint("owner_id", { mode: "number" }),
	personal: boolean().default(false),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	extraBillingInfo: text("extra_billing_info"),
	domain: varchar(),
	subdomain: varchar(),
	billingEmail: varchar("billing_email"),
	accountUsersCount: integer("account_users_count").default(0),
}, (table) => [
	index("index_accounts_on_owner_id").using("btree", table.ownerId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "fk_rails_37ced7af95"
		}),
]);

export const activeStorageBlobs = pgTable("active_storage_blobs", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	key: varchar().notNull(),
	filename: varchar().notNull(),
	contentType: varchar("content_type"),
	metadata: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	byteSize: bigint("byte_size", { mode: "number" }).notNull(),
	checksum: varchar(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	serviceName: varchar("service_name").notNull(),
}, (table) => [
	uniqueIndex("index_active_storage_blobs_on_key").using("btree", table.key.asc().nullsLast().op("text_ops")),
]);

export const accountUsers = pgTable("account_users", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	accountId: bigint("account_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }),
	roles: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("index_account_users_on_account_id_and_user_id").using("btree", table.accountId.asc().nullsLast().op("int8_ops"), table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_rails_685e030c15"
		}),
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "fk_rails_c96445f213"
		}),
]);

export const actionTextEmbeds = pgTable("action_text_embeds", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	url: varchar(),
	fields: jsonb(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
});

export const actionTextRichTexts = pgTable("action_text_rich_texts", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar().notNull(),
	body: text(),
	recordType: varchar("record_type").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	recordId: bigint("record_id", { mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("index_action_text_rich_texts_uniqueness").using("btree", table.recordType.asc().nullsLast().op("int8_ops"), table.recordId.asc().nullsLast().op("text_ops"), table.name.asc().nullsLast().op("int8_ops")),
]);

export const activeStorageAttachments = pgTable("active_storage_attachments", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar().notNull(),
	recordType: varchar("record_type").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	recordId: bigint("record_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	blobId: bigint("blob_id", { mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("index_active_storage_attachments_on_blob_id").using("btree", table.blobId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("index_active_storage_attachments_uniqueness").using("btree", table.recordType.asc().nullsLast().op("text_ops"), table.recordId.asc().nullsLast().op("text_ops"), table.name.asc().nullsLast().op("int8_ops"), table.blobId.asc().nullsLast().op("text_ops")),
]);

export const accountInvitations = pgTable("account_invitations", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	accountId: bigint("account_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	invitedById: bigint("invited_by_id", { mode: "number" }),
	token: varchar().notNull(),
	name: varchar().notNull(),
	email: varchar().notNull(),
	roles: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("index_account_invitations_on_account_id_and_email").using("btree", table.accountId.asc().nullsLast().op("int8_ops"), table.email.asc().nullsLast().op("int8_ops")),
	index("index_account_invitations_on_invited_by_id").using("btree", table.invitedById.asc().nullsLast().op("int8_ops")),
	uniqueIndex("index_account_invitations_on_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.invitedById],
			foreignColumns: [users.id],
			name: "fk_rails_04a176d6ed"
		}),
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "fk_rails_7a9e106543"
		}),
]);

export const activeStorageVariantRecords = pgTable("active_storage_variant_records", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	blobId: bigint("blob_id", { mode: "number" }).notNull(),
	variationDigest: varchar("variation_digest").notNull(),
}, (table) => [
	uniqueIndex("index_active_storage_variant_records_uniqueness").using("btree", table.blobId.asc().nullsLast().op("int8_ops"), table.variationDigest.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.blobId],
			foreignColumns: [activeStorageBlobs.id],
			name: "fk_rails_993965df05"
		}),
]);

export const announcements = pgTable("announcements", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	kind: varchar(),
	title: varchar(),
	publishedAt: timestamp("published_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
});

export const arInternalMetadata = pgTable("ar_internal_metadata", {
	key: varchar().primaryKey().notNull(),
	value: varchar(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
});

export const apiTokens = pgTable("api_tokens", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	token: varchar(),
	name: varchar(),
	metadata: jsonb(),
	transient: boolean().default(false),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("index_api_tokens_on_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("index_api_tokens_on_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_rails_f16b5e0447"
		}),
]);

export const cloudflareFirewallRules = pgTable("cloudflare_firewall_rules", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	firewallId: bigint("firewall_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	domainId: bigint("domain_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	accountId: bigint("account_id", { mode: "number" }).notNull(),
	status: varchar().default('inactive').notNull(),
	cloudflareRuleId: varchar("cloudflare_rule_id").notNull(),
	blockedAt: timestamp("blocked_at", { precision: 6, mode: 'string' }),
	unblockedAt: timestamp("unblocked_at", { precision: 6, mode: 'string' }),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_cloudflare_firewall_rules_on_account_id").using("btree", table.accountId.asc().nullsLast().op("int8_ops")),
	index("index_cloudflare_firewall_rules_on_blocked_at").using("btree", table.blockedAt.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex("index_cloudflare_firewall_rules_on_cloudflare_rule_id").using("btree", table.cloudflareRuleId.asc().nullsLast().op("text_ops")),
	index("index_cloudflare_firewall_rules_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex("index_cloudflare_firewall_rules_on_domain_id").using("btree", table.domainId.asc().nullsLast().op("int8_ops")),
	index("index_cloudflare_firewall_rules_on_firewall_id").using("btree", table.firewallId.asc().nullsLast().op("int8_ops")),
	index("index_cloudflare_firewall_rules_on_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("index_cloudflare_firewall_rules_on_unblocked_at").using("btree", table.unblockedAt.asc().nullsLast().op("timestamp_ops")),
]);

export const cloudflareFirewalls = pgTable("cloudflare_firewalls", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	accountId: bigint("account_id", { mode: "number" }).notNull(),
	status: varchar().default('inactive'),
	blockedAt: timestamp("blocked_at", { precision: 6, mode: 'string' }),
	unblockedAt: timestamp("unblocked_at", { precision: 6, mode: 'string' }),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_cloudflare_firewalls_on_account_id").using("btree", table.accountId.asc().nullsLast().op("int8_ops")),
	index("index_cloudflare_firewalls_on_blocked_at").using("btree", table.blockedAt.asc().nullsLast().op("timestamp_ops")),
	index("index_cloudflare_firewalls_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_cloudflare_firewalls_on_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("index_cloudflare_firewalls_on_unblocked_at").using("btree", table.unblockedAt.asc().nullsLast().op("timestamp_ops")),
]);

export const websiteFiles = pgTable("website_files", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	websiteId: bigint("website_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSpecificationId: bigint("file_specification_id", { mode: "number" }),
	path: varchar().notNull(),
	content: varchar().notNull(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	shasum: varchar(),
	contentTsv: tsvector("content_tsv"),
}, (table) => [
	index("idx_website_files_content_tsv").using("gin", table.contentTsv.asc().nullsLast().op("tsvector_ops")),
	index("idx_website_files_path_trgm").using("gin", table.path.asc().nullsLast().op("gin_trgm_ops")),
	index("index_website_files_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_website_files_on_file_specification_id").using("btree", table.fileSpecificationId.asc().nullsLast().op("int8_ops")),
	index("index_website_files_on_shasum").using("btree", table.shasum.asc().nullsLast().op("text_ops")),
	index("index_website_files_on_updated_at").using("btree", table.updatedAt.asc().nullsLast().op("timestamp_ops")),
	index("index_website_files_on_website_id").using("btree", table.websiteId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("index_website_files_on_website_id_and_path_unique").using("btree", table.websiteId.asc().nullsLast().op("text_ops"), table.path.asc().nullsLast().op("text_ops")),
]);

export const websites = pgTable("websites", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	projectId: bigint("project_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	accountId: bigint("account_id", { mode: "number" }),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	threadId: varchar("thread_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	templateId: bigint("template_id", { mode: "number" }),
	themeId: integer("theme_id"),
}, (table) => [
	index("index_websites_on_account_id").using("btree", table.accountId.asc().nullsLast().op("int8_ops")),
	index("index_websites_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_websites_on_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("index_websites_on_project_id").using("btree", table.projectId.asc().nullsLast().op("int8_ops")),
	index("index_websites_on_template_id").using("btree", table.templateId.asc().nullsLast().op("int8_ops")),
	index("index_websites_on_theme_id").using("btree", table.themeId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("index_websites_on_thread_id").using("btree", table.threadId.asc().nullsLast().op("text_ops")),
]);

export const componentContentPlans = pgTable("component_content_plans", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	componentOverviewId: bigint("component_overview_id", { mode: "number" }).notNull(),
	componentType: varchar("component_type"),
	data: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	componentId: integer("component_id"),
}, (table) => [
	index("index_component_content_plans_on_component_id").using("btree", table.componentId.asc().nullsLast().op("int4_ops")),
	index("index_component_content_plans_on_component_overview_id").using("btree", table.componentOverviewId.asc().nullsLast().op("int8_ops")),
	index("index_component_content_plans_on_component_type").using("btree", table.componentType.asc().nullsLast().op("text_ops")),
	index("index_component_content_plans_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_component_content_plans_on_data").using("gin", table.data.asc().nullsLast().op("jsonb_ops")),
]);

export const componentOverviews = pgTable("component_overviews", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	websiteId: bigint("website_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pageId: bigint("page_id", { mode: "number" }),
	componentType: varchar("component_type"),
	name: varchar(),
	path: varchar(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	componentId: bigint("component_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSpecificationId: bigint("file_specification_id", { mode: "number" }),
	purpose: varchar(),
	context: varchar(),
	copy: varchar(),
	backgroundColor: varchar("background_color"),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	sortOrder: integer("sort_order"),
}, (table) => [
	index("index_component_overviews_on_component_id").using("btree", table.componentId.asc().nullsLast().op("int8_ops")),
	index("index_component_overviews_on_component_type").using("btree", table.componentType.asc().nullsLast().op("text_ops")),
	index("index_component_overviews_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_component_overviews_on_file_specification_id").using("btree", table.fileSpecificationId.asc().nullsLast().op("int8_ops")),
	index("index_component_overviews_on_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("index_component_overviews_on_page_id").using("btree", table.pageId.asc().nullsLast().op("int8_ops")),
	index("index_component_overviews_on_path").using("btree", table.path.asc().nullsLast().op("text_ops")),
	index("index_component_overviews_on_sort_order").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
	index("index_component_overviews_on_website_id").using("btree", table.websiteId.asc().nullsLast().op("int8_ops")),
]);

export const components = pgTable("components", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	websiteId: bigint("website_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pageId: bigint("page_id", { mode: "number" }).notNull(),
	name: varchar().notNull(),
	path: varchar(),
	componentType: varchar("component_type"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSpecificationId: bigint("file_specification_id", { mode: "number" }).notNull(),
	themeVariantId: integer("theme_variant_id"),
	componentOverviewId: integer("component_overview_id"),
	componentContentPlanId: integer("component_content_plan_id"),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	websiteFileId: integer("website_file_id"),
}, (table) => [
	index("index_components_on_component_content_plan_id").using("btree", table.componentContentPlanId.asc().nullsLast().op("int4_ops")),
	index("index_components_on_component_overview_id").using("btree", table.componentOverviewId.asc().nullsLast().op("int4_ops")),
	index("index_components_on_component_type").using("btree", table.componentType.asc().nullsLast().op("text_ops")),
	index("index_components_on_file_specification_id").using("btree", table.fileSpecificationId.asc().nullsLast().op("int8_ops")),
	index("index_components_on_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("index_components_on_page_id").using("btree", table.pageId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("index_components_on_page_id_and_name").using("btree", table.pageId.asc().nullsLast().op("text_ops"), table.name.asc().nullsLast().op("int8_ops")),
	index("index_components_on_theme_variant_id").using("btree", table.themeVariantId.asc().nullsLast().op("int4_ops")),
	index("index_components_on_website_file_id").using("btree", table.websiteFileId.asc().nullsLast().op("int4_ops")),
	index("index_components_on_website_id").using("btree", table.websiteId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("index_components_on_website_id_and_path").using("btree", table.websiteId.asc().nullsLast().op("int8_ops"), table.path.asc().nullsLast().op("int8_ops")),
]);

export const connectedAccounts = pgTable("connected_accounts", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ownerId: bigint("owner_id", { mode: "number" }),
	provider: varchar(),
	uid: varchar(),
	refreshToken: varchar("refresh_token"),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	auth: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	accessToken: varchar("access_token"),
	accessTokenSecret: varchar("access_token_secret"),
	ownerType: varchar("owner_type"),
}, (table) => [
	index("index_connected_accounts_on_owner_id_and_owner_type").using("btree", table.ownerId.asc().nullsLast().op("int8_ops"), table.ownerType.asc().nullsLast().op("int8_ops")),
]);

export const templateFiles = pgTable("template_files", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	templateId: bigint("template_id", { mode: "number" }),
	path: varchar(),
	content: text(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	shasum: varchar(),
	fileSpecificationId: integer("file_specification_id"),
	contentTsv: tsvector("content_tsv"),
}, (table) => [
	index("idx_template_files_content_tsv").using("gin", table.contentTsv.asc().nullsLast().op("tsvector_ops")),
	index("idx_template_files_path_trgm").using("gin", table.path.asc().nullsLast().op("gin_trgm_ops")),
	index("index_template_files_on_file_specification_id").using("btree", table.fileSpecificationId.asc().nullsLast().op("int4_ops")),
	index("index_template_files_on_path").using("btree", table.path.asc().nullsLast().op("text_ops")),
	index("index_template_files_on_shasum").using("btree", table.shasum.asc().nullsLast().op("text_ops")),
	index("index_template_files_on_template_id").using("btree", table.templateId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("index_template_files_on_template_id_and_path").using("btree", table.templateId.asc().nullsLast().op("text_ops"), table.path.asc().nullsLast().op("text_ops")),
]);

export const deployFiles = pgTable("deploy_files", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	deployId: bigint("deploy_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	websiteFileId: bigint("website_file_id", { mode: "number" }),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_deploy_files_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_deploy_files_on_deploy_id").using("btree", table.deployId.asc().nullsLast().op("int8_ops")),
	index("index_deploy_files_on_website_file_id").using("btree", table.websiteFileId.asc().nullsLast().op("int8_ops")),
]);

export const deploys = pgTable("deploys", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	websiteId: bigint("website_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	websiteHistoryId: bigint("website_history_id", { mode: "number" }),
	status: varchar().notNull(),
	trigger: varchar().default('manual'),
	stacktrace: text(),
	snapshotId: varchar("snapshot_id"),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	isLive: boolean("is_live").default(false),
	revertible: boolean().default(false),
	versionPath: varchar("version_path"),
	environment: varchar().default('production').notNull(),
	isPreview: boolean("is_preview").default(false).notNull(),
	shasum: varchar(),
}, (table) => [
	index("index_deploys_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_deploys_on_environment").using("btree", table.environment.asc().nullsLast().op("text_ops")),
	index("index_deploys_on_is_live").using("btree", table.isLive.asc().nullsLast().op("bool_ops")),
	index("index_deploys_on_is_preview").using("btree", table.isPreview.asc().nullsLast().op("bool_ops")),
	index("index_deploys_on_revertible").using("btree", table.revertible.asc().nullsLast().op("bool_ops")),
	index("index_deploys_on_shasum").using("btree", table.shasum.asc().nullsLast().op("text_ops")),
	index("index_deploys_on_snapshot_id").using("btree", table.snapshotId.asc().nullsLast().op("text_ops")),
	index("index_deploys_on_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("index_deploys_on_trigger").using("btree", table.trigger.asc().nullsLast().op("text_ops")),
	index("index_deploys_on_website_history_id").using("btree", table.websiteHistoryId.asc().nullsLast().op("int8_ops")),
	index("index_deploys_on_website_id").using("btree", table.websiteId.asc().nullsLast().op("int8_ops")),
	index("index_deploys_on_website_id_and_environment_and_is_preview").using("btree", table.websiteId.asc().nullsLast().op("int8_ops"), table.environment.asc().nullsLast().op("int8_ops"), table.isPreview.asc().nullsLast().op("int8_ops")),
	index("index_deploys_on_website_id_and_is_live").using("btree", table.websiteId.asc().nullsLast().op("int8_ops"), table.isLive.asc().nullsLast().op("int8_ops")),
]);

export const domains = pgTable("domains", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	domain: varchar(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	websiteId: bigint("website_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	accountId: bigint("account_id", { mode: "number" }),
	cloudflareZoneId: varchar("cloudflare_zone_id"),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_domains_on_account_id").using("btree", table.accountId.asc().nullsLast().op("int8_ops")),
	index("index_domains_on_cloudflare_zone_id").using("btree", table.cloudflareZoneId.asc().nullsLast().op("text_ops")),
	index("index_domains_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_domains_on_domain").using("btree", table.domain.asc().nullsLast().op("text_ops")),
	index("index_domains_on_website_id").using("btree", table.websiteId.asc().nullsLast().op("int8_ops")),
]);

export const fileSpecifications = pgTable("file_specifications", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	canonicalPath: varchar("canonical_path"),
	description: varchar(),
	filetype: varchar(),
	componentType: varchar("component_type"),
	language: varchar(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_file_specifications_on_canonical_path").using("btree", table.canonicalPath.asc().nullsLast().op("text_ops")),
	index("index_file_specifications_on_component_type").using("btree", table.componentType.asc().nullsLast().op("text_ops")),
	index("index_file_specifications_on_filetype").using("btree", table.filetype.asc().nullsLast().op("text_ops")),
]);

export const iconEmbeddings = pgTable("icon_embeddings", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	key: varchar().notNull(),
	text: text().notNull(),
	embedding: vector({ dimensions: 1536 }).notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
}, (table) => [
	index("idx_icon_embeddings_text").using("ivfflat", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	uniqueIndex("index_icon_embeddings_on_key").using("btree", table.key.asc().nullsLast().op("text_ops")),
]);

export const contentStrategies = pgTable("content_strategies", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	tone: varchar().notNull(),
	coreEmotionalDriver: varchar("core_emotional_driver"),
	attentionGrabber: varchar("attention_grabber"),
	problemStatement: varchar("problem_statement"),
	emotionalBridge: varchar("emotional_bridge"),
	productReveal: varchar("product_reveal"),
	socialProof: varchar("social_proof"),
	urgencyHook: varchar("urgency_hook"),
	callToAction: varchar("call_to_action"),
	pageMood: varchar("page_mood"),
	visualEvocation: varchar("visual_evocation"),
	landingPageCopy: text("landing_page_copy"),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	websiteId: integer("website_id"),
	summary: text(),
	audience: varchar(),
}, (table) => [
	index("index_content_strategies_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_content_strategies_on_updated_at").using("btree", table.updatedAt.asc().nullsLast().op("timestamp_ops")),
	index("index_content_strategies_on_website_id").using("btree", table.websiteId.asc().nullsLast().op("int4_ops")),
]);

export const iconQueryCaches = pgTable("icon_query_caches", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	query: varchar().notNull(),
	results: jsonb().default([]).notNull(),
	useCount: integer("use_count").default(0).notNull(),
	ttlSeconds: integer("ttl_seconds").default(86400).notNull(),
	minSimilarity: doublePrecision("min_similarity").default(0.7).notNull(),
	topK: integer("top_k").notNull(),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_icon_query_caches_on_last_used_at").using("btree", table.lastUsedAt.asc().nullsLast().op("timestamp_ops")),
	index("index_icon_query_caches_on_min_similarity").using("btree", table.minSimilarity.asc().nullsLast().op("float8_ops")),
	index("index_icon_query_caches_on_query").using("btree", table.query.asc().nullsLast().op("text_ops")),
	index("index_icon_query_caches_on_top_k").using("btree", table.topK.asc().nullsLast().op("int4_ops")),
	index("index_icon_query_caches_on_ttl_seconds").using("btree", table.ttlSeconds.asc().nullsLast().op("int4_ops")),
	index("index_icon_query_caches_on_use_count").using("btree", table.useCount.asc().nullsLast().op("int4_ops")),
]);

export const inboundWebhooks = pgTable("inbound_webhooks", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	status: integer().default(0).notNull(),
	body: text(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
});

export const noticedEvents = pgTable("noticed_events", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	accountId: bigint("account_id", { mode: "number" }),
	type: varchar(),
	recordType: varchar("record_type"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	recordId: bigint("record_id", { mode: "number" }),
	params: jsonb(),
	notificationsCount: integer("notifications_count"),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_noticed_events_on_account_id").using("btree", table.accountId.asc().nullsLast().op("int8_ops")),
	index("index_noticed_events_on_record").using("btree", table.recordType.asc().nullsLast().op("int8_ops"), table.recordId.asc().nullsLast().op("int8_ops")),
]);

export const noticedNotifications = pgTable("noticed_notifications", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	accountId: bigint("account_id", { mode: "number" }),
	type: varchar(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	eventId: bigint("event_id", { mode: "number" }).notNull(),
	recipientType: varchar("recipient_type").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	recipientId: bigint("recipient_id", { mode: "number" }).notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	seenAt: timestamp("seen_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_noticed_notifications_on_account_id").using("btree", table.accountId.asc().nullsLast().op("int8_ops")),
	index("index_noticed_notifications_on_event_id").using("btree", table.eventId.asc().nullsLast().op("int8_ops")),
	index("index_noticed_notifications_on_recipient").using("btree", table.recipientType.asc().nullsLast().op("int8_ops"), table.recipientId.asc().nullsLast().op("int8_ops")),
]);

export const notificationTokens = pgTable("notification_tokens", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }),
	token: varchar().notNull(),
	platform: varchar().notNull(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_notification_tokens_on_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
]);

export const notifications = pgTable("notifications", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	accountId: bigint("account_id", { mode: "number" }).notNull(),
	recipientType: varchar("recipient_type").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	recipientId: bigint("recipient_id", { mode: "number" }).notNull(),
	type: varchar(),
	params: jsonb(),
	readAt: timestamp("read_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	interactedAt: timestamp("interacted_at", { mode: 'string' }),
}, (table) => [
	index("index_notifications_on_account_id").using("btree", table.accountId.asc().nullsLast().op("int8_ops")),
	index("index_notifications_on_recipient_type_and_recipient_id").using("btree", table.recipientType.asc().nullsLast().op("int8_ops"), table.recipientId.asc().nullsLast().op("int8_ops")),
]);

export const pages = pgTable("pages", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar(),
	pageType: varchar("page_type").notNull(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	websiteId: bigint("website_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	websiteFileId: bigint("website_file_id", { mode: "number" }),
	path: varchar(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSpecificationId: bigint("file_specification_id", { mode: "number" }),
}, (table) => [
	index("index_pages_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_pages_on_file_specification_id").using("btree", table.fileSpecificationId.asc().nullsLast().op("int8_ops")),
	index("index_pages_on_path").using("btree", table.path.asc().nullsLast().op("text_ops")),
	index("index_pages_on_website_file_id").using("btree", table.websiteFileId.asc().nullsLast().op("int8_ops")),
	index("index_pages_on_website_id").using("btree", table.websiteId.asc().nullsLast().op("int8_ops")),
]);

export const paySubscriptions = pgTable("pay_subscriptions", {
	id: serial().primaryKey().notNull(),
	name: varchar().notNull(),
	processorId: varchar("processor_id").notNull(),
	processorPlan: varchar("processor_plan").notNull(),
	quantity: integer().default(1).notNull(),
	trialEndsAt: timestamp("trial_ends_at", { mode: 'string' }),
	endsAt: timestamp("ends_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	status: varchar(),
	data: jsonb(),
	applicationFeePercent: numeric("application_fee_percent", { precision: 8, scale:  2 }),
	metadata: jsonb(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	customerId: bigint("customer_id", { mode: "number" }),
	currentPeriodStart: timestamp("current_period_start", { precision: 6, mode: 'string' }),
	currentPeriodEnd: timestamp("current_period_end", { precision: 6, mode: 'string' }),
	metered: boolean(),
	pauseBehavior: varchar("pause_behavior"),
	pauseStartsAt: timestamp("pause_starts_at", { precision: 6, mode: 'string' }),
	pauseResumesAt: timestamp("pause_resumes_at", { precision: 6, mode: 'string' }),
	paymentMethodId: varchar("payment_method_id"),
	stripeAccount: varchar("stripe_account"),
	type: varchar(),
}, (table) => [
	uniqueIndex("index_pay_subscriptions_on_customer_id_and_processor_id").using("btree", table.customerId.asc().nullsLast().op("text_ops"), table.processorId.asc().nullsLast().op("int8_ops")),
	index("index_pay_subscriptions_on_metered").using("btree", table.metered.asc().nullsLast().op("bool_ops")),
	index("index_pay_subscriptions_on_pause_starts_at").using("btree", table.pauseStartsAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [payCustomers.id],
			name: "fk_rails_b7cd64d378"
		}),
]);

export const payPaymentMethods = pgTable("pay_payment_methods", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	customerId: bigint("customer_id", { mode: "number" }),
	processorId: varchar("processor_id"),
	default: boolean(),
	paymentMethodType: varchar("payment_method_type"),
	data: jsonb(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	stripeAccount: varchar("stripe_account"),
	type: varchar(),
}, (table) => [
	uniqueIndex("index_pay_payment_methods_on_customer_id_and_processor_id").using("btree", table.customerId.asc().nullsLast().op("int8_ops"), table.processorId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [payCustomers.id],
			name: "fk_rails_c78c6cb84d"
		}),
]);

export const payMerchants = pgTable("pay_merchants", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	ownerType: varchar("owner_type"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ownerId: bigint("owner_id", { mode: "number" }),
	processor: varchar(),
	processorId: varchar("processor_id"),
	default: boolean(),
	data: jsonb(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	type: varchar(),
}, (table) => [
	index("index_pay_merchants_on_owner_type_and_owner_id_and_processor").using("btree", table.ownerType.asc().nullsLast().op("text_ops"), table.ownerId.asc().nullsLast().op("int8_ops"), table.processor.asc().nullsLast().op("int8_ops")),
]);

export const payWebhooks = pgTable("pay_webhooks", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	processor: varchar(),
	eventType: varchar("event_type"),
	event: jsonb(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
});

export const planLimits = pgTable("plan_limits", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	planId: bigint("plan_id", { mode: "number" }),
	limitType: varchar("limit_type"),
	limit: integer(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_plan_limits_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_plan_limits_on_limit").using("btree", table.limit.asc().nullsLast().op("int4_ops")),
	index("index_plan_limits_on_limit_type").using("btree", table.limitType.asc().nullsLast().op("text_ops")),
	index("index_plan_limits_on_plan_id").using("btree", table.planId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("index_plan_limits_on_plan_id_and_limit_type").using("btree", table.planId.asc().nullsLast().op("text_ops"), table.limitType.asc().nullsLast().op("text_ops")),
]);

export const plans = pgTable("plans", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar().notNull(),
	amount: integer().default(0).notNull(),
	interval: varchar().notNull(),
	details: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	trialPeriodDays: integer("trial_period_days").default(0),
	hidden: boolean(),
	currency: varchar(),
	intervalCount: integer("interval_count").default(1),
	description: varchar(),
	unitLabel: varchar("unit_label"),
	chargePerUnit: boolean("charge_per_unit"),
	stripeId: varchar("stripe_id"),
	braintreeId: varchar("braintree_id"),
	paddleBillingId: varchar("paddle_billing_id"),
	paddleClassicId: varchar("paddle_classic_id"),
	lemonSqueezyId: varchar("lemon_squeezy_id"),
	fakeProcessorId: varchar("fake_processor_id"),
	contactUrl: varchar("contact_url"),
}, (table) => [
	index("index_plans_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex("index_plans_on_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const projects = pgTable("projects", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	accountId: bigint("account_id", { mode: "number" }).notNull(),
	threadId: varchar("thread_id").notNull(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_projects_on_account_id").using("btree", table.accountId.asc().nullsLast().op("int8_ops")),
	index("index_projects_on_account_id_and_created_at").using("btree", table.accountId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("int8_ops")),
	uniqueIndex("index_projects_on_account_id_and_name").using("btree", table.accountId.asc().nullsLast().op("int8_ops"), table.name.asc().nullsLast().op("int8_ops")),
	uniqueIndex("index_projects_on_account_id_and_thread_id").using("btree", table.accountId.asc().nullsLast().op("int8_ops"), table.threadId.asc().nullsLast().op("int8_ops")),
	index("index_projects_on_account_id_and_updated_at").using("btree", table.accountId.asc().nullsLast().op("int8_ops"), table.updatedAt.asc().nullsLast().op("timestamp_ops")),
	index("index_projects_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_projects_on_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("index_projects_on_thread_id").using("btree", table.threadId.asc().nullsLast().op("text_ops")),
	index("index_projects_on_updated_at").using("btree", table.updatedAt.asc().nullsLast().op("timestamp_ops")),
]);

export const payCustomers = pgTable("pay_customers", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	ownerType: varchar("owner_type"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ownerId: bigint("owner_id", { mode: "number" }),
	processor: varchar(),
	processorId: varchar("processor_id"),
	default: boolean(),
	data: jsonb(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	stripeAccount: varchar("stripe_account"),
	type: varchar(),
}, (table) => [
	index("customer_owner_processor_index").using("btree", table.ownerType.asc().nullsLast().op("timestamp_ops"), table.ownerId.asc().nullsLast().op("int8_ops"), table.deletedAt.asc().nullsLast().op("timestamp_ops")),
	index("index_pay_customers_on_processor_and_processor_id").using("btree", table.processor.asc().nullsLast().op("text_ops"), table.processorId.asc().nullsLast().op("text_ops")),
]);

export const schemaMigrations = pgTable("schema_migrations", {
	version: varchar().primaryKey().notNull(),
});

export const tasks = pgTable("tasks", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	type: varchar(),
	subtype: varchar(),
	title: varchar(),
	instructions: varchar(),
	status: varchar(),
	action: varchar(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSpecificationId: bigint("file_specification_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	componentId: bigint("component_id", { mode: "number" }),
	componentType: varchar("component_type"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	componentOverviewId: bigint("component_overview_id", { mode: "number" }),
	results: jsonb(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	projectId: bigint("project_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	websiteId: bigint("website_id", { mode: "number" }),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	websiteFileId: integer("website_file_id"),
	path: varchar(),
}, (table) => [
	index("index_tasks_on_action").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("index_tasks_on_component_id").using("btree", table.componentId.asc().nullsLast().op("int8_ops")),
	index("index_tasks_on_component_overview_id").using("btree", table.componentOverviewId.asc().nullsLast().op("int8_ops")),
	index("index_tasks_on_component_type").using("btree", table.componentType.asc().nullsLast().op("text_ops")),
	index("index_tasks_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_tasks_on_file_specification_id").using("btree", table.fileSpecificationId.asc().nullsLast().op("int8_ops")),
	index("index_tasks_on_path").using("btree", table.path.asc().nullsLast().op("text_ops")),
	index("index_tasks_on_project_id").using("btree", table.projectId.asc().nullsLast().op("int8_ops")),
	index("index_tasks_on_results").using("gin", table.results.asc().nullsLast().op("jsonb_ops")),
	index("index_tasks_on_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("index_tasks_on_subtype").using("btree", table.subtype.asc().nullsLast().op("text_ops")),
	index("index_tasks_on_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	index("index_tasks_on_website_file_id").using("btree", table.websiteFileId.asc().nullsLast().op("int4_ops")),
	index("index_tasks_on_website_id").using("btree", table.websiteId.asc().nullsLast().op("int8_ops")),
]);

export const templates = pgTable("templates", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("index_templates_on_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const themeLabels = pgTable("theme_labels", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar().notNull(),
}, (table) => [
	index("index_theme_labels_on_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const themeVariants = pgTable("theme_variants", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	backgroundClass: varchar("background_class").notNull(),
	foregroundClass: varchar("foreground_class"),
	mutedClass: varchar("muted_class"),
	primaryClass: varchar("primary_class"),
	secondaryClass: varchar("secondary_class"),
	accentClass: varchar("accent_class"),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("index_theme_variants_on_background_class").using("btree", table.backgroundClass.asc().nullsLast().op("text_ops")),
	index("index_theme_variants_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
]);

export const themes = pgTable("themes", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar().notNull(),
	colors: jsonb().default({}),
	theme: jsonb().default({}),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_themes_on_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const themesToThemeLabels = pgTable("themes_to_theme_labels", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	themeId: bigint("theme_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	themeLabelId: bigint("theme_label_id", { mode: "number" }).notNull(),
}, (table) => [
	index("index_themes_to_theme_labels_on_theme_id").using("btree", table.themeId.asc().nullsLast().op("int8_ops")),
	index("index_themes_to_theme_labels_on_theme_id_and_theme_label_id").using("btree", table.themeId.asc().nullsLast().op("int8_ops"), table.themeLabelId.asc().nullsLast().op("int8_ops")),
	index("index_themes_to_theme_labels_on_theme_label_id").using("btree", table.themeLabelId.asc().nullsLast().op("int8_ops")),
]);

export const websiteFileHistories = pgTable("website_file_histories", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	websiteFileId: integer("website_file_id").notNull(),
	websiteId: integer("website_id").notNull(),
	fileSpecificationId: integer("file_specification_id"),
	path: varchar().notNull(),
	content: varchar().notNull(),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	historyStartedAt: timestamp("history_started_at", { precision: 6, mode: 'string' }).notNull(),
	historyEndedAt: timestamp("history_ended_at", { precision: 6, mode: 'string' }),
	historyUserId: integer("history_user_id"),
	snapshotId: varchar("snapshot_id"),
	shasum: varchar(),
	contentTsv: tsvector("content_tsv"),
}, (table) => [
	index("idx_website_file_histories_content_tsv").using("gin", table.contentTsv.asc().nullsLast().op("tsvector_ops")),
	index("index_website_file_histories_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_website_file_histories_on_file_specification_id").using("btree", table.fileSpecificationId.asc().nullsLast().op("int4_ops")),
	index("index_website_file_histories_on_history_ended_at").using("btree", table.historyEndedAt.asc().nullsLast().op("timestamp_ops")),
	index("index_website_file_histories_on_history_started_at").using("btree", table.historyStartedAt.asc().nullsLast().op("timestamp_ops")),
	index("index_website_file_histories_on_history_user_id").using("btree", table.historyUserId.asc().nullsLast().op("int4_ops")),
	index("index_website_file_histories_on_shasum").using("btree", table.shasum.asc().nullsLast().op("text_ops")),
	index("index_website_file_histories_on_snapshot_id").using("btree", table.snapshotId.asc().nullsLast().op("text_ops")),
	index("index_website_file_histories_on_updated_at").using("btree", table.updatedAt.asc().nullsLast().op("timestamp_ops")),
	index("index_website_file_histories_on_website_file_id").using("btree", table.websiteFileId.asc().nullsLast().op("int4_ops")),
	index("index_website_file_histories_on_website_id").using("btree", table.websiteId.asc().nullsLast().op("int4_ops")),
]);

export const websiteHistories = pgTable("website_histories", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	websiteId: integer("website_id").notNull(),
	name: varchar(),
	projectId: integer("project_id"),
	accountId: integer("account_id"),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
	historyStartedAt: timestamp("history_started_at", { precision: 6, mode: 'string' }).notNull(),
	historyEndedAt: timestamp("history_ended_at", { precision: 6, mode: 'string' }),
	historyUserId: integer("history_user_id"),
	snapshotId: varchar("snapshot_id"),
	threadId: varchar("thread_id"),
	templateId: integer("template_id"),
	themeId: integer("theme_id"),
}, (table) => [
	index("index_website_histories_on_account_id").using("btree", table.accountId.asc().nullsLast().op("int4_ops")),
	index("index_website_histories_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_website_histories_on_history_ended_at").using("btree", table.historyEndedAt.asc().nullsLast().op("timestamp_ops")),
	index("index_website_histories_on_history_started_at").using("btree", table.historyStartedAt.asc().nullsLast().op("timestamp_ops")),
	index("index_website_histories_on_history_user_id").using("btree", table.historyUserId.asc().nullsLast().op("int4_ops")),
	index("index_website_histories_on_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("index_website_histories_on_project_id").using("btree", table.projectId.asc().nullsLast().op("int4_ops")),
	index("index_website_histories_on_snapshot_id").using("btree", table.snapshotId.asc().nullsLast().op("text_ops")),
	index("index_website_histories_on_template_id").using("btree", table.templateId.asc().nullsLast().op("int4_ops")),
	index("index_website_histories_on_theme_id").using("btree", table.themeId.asc().nullsLast().op("int4_ops")),
	index("index_website_histories_on_thread_id").using("btree", table.threadId.asc().nullsLast().op("text_ops")),
	index("index_website_histories_on_website_id").using("btree", table.websiteId.asc().nullsLast().op("int4_ops")),
]);

export const users = pgTable("users", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	email: varchar().default('').notNull(),
	encryptedPassword: varchar("encrypted_password").default('').notNull(),
	resetPasswordToken: varchar("reset_password_token"),
	resetPasswordSentAt: timestamp("reset_password_sent_at", { mode: 'string' }),
	rememberCreatedAt: timestamp("remember_created_at", { mode: 'string' }),
	confirmationToken: varchar("confirmation_token"),
	confirmedAt: timestamp("confirmed_at", { mode: 'string' }),
	confirmationSentAt: timestamp("confirmation_sent_at", { mode: 'string' }),
	unconfirmedEmail: varchar("unconfirmed_email"),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	timeZone: varchar("time_zone"),
	acceptedTermsAt: timestamp("accepted_terms_at", { mode: 'string' }),
	acceptedPrivacyAt: timestamp("accepted_privacy_at", { mode: 'string' }),
	announcementsReadAt: timestamp("announcements_read_at", { mode: 'string' }),
	admin: boolean(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	invitationToken: varchar("invitation_token"),
	invitationCreatedAt: timestamp("invitation_created_at", { mode: 'string' }),
	invitationSentAt: timestamp("invitation_sent_at", { mode: 'string' }),
	invitationAcceptedAt: timestamp("invitation_accepted_at", { mode: 'string' }),
	invitationLimit: integer("invitation_limit"),
	invitedByType: varchar("invited_by_type"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	invitedById: bigint("invited_by_id", { mode: "number" }),
	invitationsCount: integer("invitations_count").default(0),
	preferredLanguage: varchar("preferred_language"),
	otpRequiredForLogin: boolean("otp_required_for_login"),
	otpSecret: varchar("otp_secret"),
	lastOtpTimestep: integer("last_otp_timestep"),
	otpBackupCodes: text("otp_backup_codes"),
	preferences: jsonb(),
	name: varchar().generatedAlwaysAs(sql`(((first_name)::text || ' '::text) || (COALESCE(last_name, ''::character varying))::text)`),
	jti: varchar().notNull(),
}, (table) => [
	uniqueIndex("index_users_on_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	uniqueIndex("index_users_on_invitation_token").using("btree", table.invitationToken.asc().nullsLast().op("text_ops")),
	index("index_users_on_invitations_count").using("btree", table.invitationsCount.asc().nullsLast().op("int4_ops")),
	index("index_users_on_invited_by_id").using("btree", table.invitedById.asc().nullsLast().op("int8_ops")),
	index("index_users_on_invited_by_type_and_invited_by_id").using("btree", table.invitedByType.asc().nullsLast().op("text_ops"), table.invitedById.asc().nullsLast().op("text_ops")),
	uniqueIndex("index_users_on_jti").using("btree", table.jti.asc().nullsLast().op("text_ops")),
	uniqueIndex("index_users_on_reset_password_token").using("btree", table.resetPasswordToken.asc().nullsLast().op("text_ops")),
]);

export const payCharges = pgTable("pay_charges", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	processorId: varchar("processor_id").notNull(),
	amount: integer().notNull(),
	amountRefunded: integer("amount_refunded"),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	data: jsonb(),
	applicationFeeAmount: integer("application_fee_amount"),
	currency: varchar(),
	metadata: jsonb(),
	subscriptionId: integer("subscription_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	customerId: bigint("customer_id", { mode: "number" }),
	stripeAccount: varchar("stripe_account"),
	type: varchar(),
}, (table) => [
	uniqueIndex("index_pay_charges_on_customer_id_and_processor_id").using("btree", table.customerId.asc().nullsLast().op("int8_ops"), table.processorId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [payCustomers.id],
			name: "fk_rails_b19d32f835"
		}),
]);

export const brainstorms = pgTable("brainstorms", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	idea: varchar(),
	audience: varchar(),
	solution: varchar(),
	socialProof: varchar("social_proof"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	websiteId: bigint("website_id", { mode: "number" }),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("index_brainstorms_on_completed_at").using("btree", table.completedAt.asc().nullsLast().op("timestamp_ops")),
	index("index_brainstorms_on_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("index_brainstorms_on_website_id").using("btree", table.websiteId.asc().nullsLast().op("int8_ops")),
]);
export const codeFiles = pgView("code_files", {	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	websiteId: bigint("website_id", { mode: "number" }),
	path: varchar(),
	content: varchar(),
	contentTsv: tsvector("content_tsv"),
	shasum: varchar(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSpecificationId: bigint("file_specification_id", { mode: "number" }),
	sourceType: text("source_type"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sourceId: bigint("source_id", { mode: "number" }),
	createdAt: timestamp("created_at", { precision: 6, mode: 'string' }),
	updatedAt: timestamp("updated_at", { precision: 6, mode: 'string' }),
}).as(sql`WITH merged_files AS ( SELECT wf.website_id, wf.path, wf.content, wf.content_tsv, wf.shasum, wf.file_specification_id, wf.created_at, wf.updated_at, 'WebsiteFile'::text AS source_type, wf.id AS source_id FROM website_files wf UNION ALL SELECT w.id AS website_id, tf.path, tf.content, tf.content_tsv, tf.shasum, tf.file_specification_id, tf.created_at, tf.updated_at, 'TemplateFile'::text AS source_type, tf.id AS source_id FROM template_files tf JOIN websites w ON w.template_id = tf.template_id WHERE NOT (EXISTS ( SELECT 1 FROM website_files wf2 WHERE wf2.website_id = w.id AND wf2.path::text = tf.path::text)) ) SELECT website_id, path, content, content_tsv, shasum, file_specification_id, source_type, source_id, created_at, updated_at FROM merged_files ORDER BY website_id, path`);