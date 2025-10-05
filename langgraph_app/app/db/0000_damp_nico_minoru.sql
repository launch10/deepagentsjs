-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE SEQUENCE "public"."account_request_counts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."domain_request_counts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."user_request_counts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"owner_id" bigint,
	"personal" boolean DEFAULT false,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL,
	"extra_billing_info" text,
	"domain" varchar,
	"subdomain" varchar,
	"billing_email" varchar,
	"account_users_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "account_invitations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint NOT NULL,
	"invited_by_id" bigint,
	"token" varchar NOT NULL,
	"name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"roles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint,
	"user_id" bigint,
	"roles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "active_storage_blobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"filename" varchar NOT NULL,
	"content_type" varchar,
	"metadata" text,
	"byte_size" bigint NOT NULL,
	"checksum" varchar,
	"created_at" timestamp NOT NULL,
	"service_name" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_text_embeds" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"url" varchar,
	"fields" jsonb,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "action_text_rich_texts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"body" text,
	"record_type" varchar NOT NULL,
	"record_id" bigint NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "active_storage_attachments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"record_type" varchar NOT NULL,
	"record_id" bigint NOT NULL,
	"blob_id" bigint NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" varchar,
	"title" varchar,
	"published_at" timestamp,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ar_internal_metadata" (
	"key" varchar PRIMARY KEY NOT NULL,
	"value" varchar,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cloudflare_firewall_rules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"firewall_id" bigint NOT NULL,
	"domain_id" bigint NOT NULL,
	"account_id" bigint NOT NULL,
	"status" varchar DEFAULT 'inactive' NOT NULL,
	"cloudflare_rule_id" varchar NOT NULL,
	"blocked_at" timestamp(6),
	"unblocked_at" timestamp(6),
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cloudflare_firewalls" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint NOT NULL,
	"status" varchar DEFAULT 'inactive',
	"blocked_at" timestamp(6),
	"unblocked_at" timestamp(6),
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"token" varchar,
	"name" varchar,
	"metadata" jsonb,
	"transient" boolean DEFAULT false,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" bigint,
	"provider" varchar,
	"uid" varchar,
	"refresh_token" varchar,
	"expires_at" timestamp,
	"auth" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"access_token" varchar,
	"access_token_secret" varchar,
	"owner_type" varchar
);
--> statement-breakpoint
CREATE TABLE "deploy_files" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"deploy_id" bigint,
	"website_file_id" bigint,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deploys" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"website_id" bigint,
	"website_history_id" bigint,
	"status" varchar NOT NULL,
	"trigger" varchar DEFAULT 'manual',
	"stacktrace" text,
	"snapshot_id" varchar,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL,
	"is_live" boolean DEFAULT false,
	"revertible" boolean DEFAULT false,
	"version_path" varchar,
	"environment" varchar DEFAULT 'production' NOT NULL,
	"is_preview" boolean DEFAULT false NOT NULL,
	"shasum" varchar
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"domain" varchar,
	"website_id" bigint,
	"account_id" bigint,
	"cloudflare_zone_id" varchar,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_specifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"canonical_path" varchar,
	"description" varchar,
	"filetype" varchar,
	"componentType" varchar,
	"language" varchar,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icon_embeddings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "inbound_webhooks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"status" integer DEFAULT 0 NOT NULL,
	"body" text,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "noticed_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint,
	"type" varchar,
	"record_type" varchar,
	"record_id" bigint,
	"params" jsonb,
	"notifications_count" integer,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "noticed_notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint,
	"type" varchar,
	"event_id" bigint NOT NULL,
	"recipient_type" varchar NOT NULL,
	"recipient_id" bigint NOT NULL,
	"read_at" timestamp,
	"seen_at" timestamp,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"token" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account_id" bigint NOT NULL,
	"recipient_type" varchar NOT NULL,
	"recipient_id" bigint NOT NULL,
	"type" varchar,
	"params" jsonb,
	"read_at" timestamp,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL,
	"interacted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar,
	"project_id" bigint NOT NULL,
	"file_id" bigint NOT NULL,
	"page_type" varchar NOT NULL,
	"plan" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_payment_methods" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" bigint,
	"processor_id" varchar,
	"default" boolean,
	"payment_method_type" varchar,
	"data" jsonb,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL,
	"stripe_account" varchar,
	"type" varchar
);
--> statement-breakpoint
CREATE TABLE "pay_merchants" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_type" varchar,
	"owner_id" bigint,
	"processor" varchar,
	"processor_id" varchar,
	"default" boolean,
	"data" jsonb,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL,
	"type" varchar
);
--> statement-breakpoint
CREATE TABLE "pay_customers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_type" varchar,
	"owner_id" bigint,
	"processor" varchar,
	"processor_id" varchar,
	"default" boolean,
	"data" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL,
	"stripe_account" varchar,
	"type" varchar
);
--> statement-breakpoint
CREATE TABLE "pay_webhooks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"processor" varchar,
	"event_type" varchar,
	"event" jsonb,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_limits" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"plan_id" bigint,
	"limit_type" varchar,
	"limit" integer,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"interval" varchar NOT NULL,
	"details" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"trial_period_days" integer DEFAULT 0,
	"hidden" boolean,
	"currency" varchar,
	"interval_count" integer DEFAULT 1,
	"description" varchar,
	"unit_label" varchar,
	"charge_per_unit" boolean,
	"stripe_id" varchar,
	"braintree_id" varchar,
	"paddle_billing_id" varchar,
	"paddle_classic_id" varchar,
	"lemon_squeezy_id" varchar,
	"fake_processor_id" varchar,
	"contact_url" varchar
);
--> statement-breakpoint
CREATE TABLE "project_plans" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" bigint NOT NULL,
	"tone" varchar NOT NULL,
	"core_emotional_driver" varchar,
	"attention_grabber" varchar,
	"problem_statement" varchar,
	"emotional_bridge" varchar,
	"product_reveal" varchar,
	"social_proof" varchar,
	"urgency_hook" varchar,
	"call_to_action" varchar,
	"page_mood" varchar,
	"visual_evocation" varchar,
	"landing_page_copy" text,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"account_id" bigint NOT NULL,
	"theme_id" bigint,
	"thread_id" varchar NOT NULL,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_migrations" (
	"version" varchar PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar,
	"page_id" bigint NOT NULL,
	"component_id" varchar NOT NULL,
	"file_id" bigint,
	"theme_variation" varchar,
	"content_plan" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_files" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"template_id" bigint,
	"path" varchar,
	"content" text,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL,
	"shasum" varchar
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme_labels" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"processor_id" varchar NOT NULL,
	"processor_plan" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"trial_ends_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp,
	"updated_at" timestamp,
	"status" varchar,
	"data" jsonb,
	"application_fee_percent" numeric(8, 2),
	"metadata" jsonb,
	"customer_id" bigint,
	"current_period_start" timestamp(6),
	"current_period_end" timestamp(6),
	"metered" boolean,
	"pause_behavior" varchar,
	"pause_starts_at" timestamp(6),
	"pause_resumes_at" timestamp(6),
	"payment_method_id" varchar,
	"stripe_account" varchar,
	"type" varchar
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"colors" jsonb DEFAULT '{}'::jsonb,
	"theme" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "themes_to_theme_labels" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"theme_id" bigint NOT NULL,
	"theme_label_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_file_histories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"website_file_id" integer NOT NULL,
	"website_id" integer NOT NULL,
	"file_specification_id" integer,
	"path" varchar NOT NULL,
	"content" varchar NOT NULL,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL,
	"history_started_at" timestamp(6) NOT NULL,
	"history_ended_at" timestamp(6),
	"history_user_id" integer,
	"snapshot_id" varchar,
	"shasum" varchar
);
--> statement-breakpoint
CREATE TABLE "website_files" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"website_id" bigint NOT NULL,
	"file_specification_id" bigint,
	"path" varchar NOT NULL,
	"content" varchar NOT NULL,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL,
	"shasum" varchar
);
--> statement-breakpoint
CREATE TABLE "website_histories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
	"name" varchar,
	"project_id" integer,
	"account_id" integer,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL,
	"history_started_at" timestamp(6) NOT NULL,
	"history_ended_at" timestamp(6),
	"history_user_id" integer,
	"snapshot_id" varchar,
	"thread_id" varchar,
	"template_id" integer
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar,
	"project_id" bigint,
	"account_id" bigint,
	"created_at" timestamp(6) NOT NULL,
	"updated_at" timestamp(6) NOT NULL,
	"thread_id" varchar,
	"template_id" bigint
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" varchar DEFAULT '' NOT NULL,
	"encrypted_password" varchar DEFAULT '' NOT NULL,
	"reset_password_token" varchar,
	"reset_password_sent_at" timestamp,
	"remember_created_at" timestamp,
	"confirmation_token" varchar,
	"confirmed_at" timestamp,
	"confirmation_sent_at" timestamp,
	"unconfirmed_email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"time_zone" varchar,
	"accepted_terms_at" timestamp,
	"accepted_privacy_at" timestamp,
	"announcements_read_at" timestamp,
	"admin" boolean,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"invitation_token" varchar,
	"invitation_created_at" timestamp,
	"invitation_sent_at" timestamp,
	"invitation_accepted_at" timestamp,
	"invitation_limit" integer,
	"invited_by_type" varchar,
	"invited_by_id" bigint,
	"invitations_count" integer DEFAULT 0,
	"preferred_language" varchar,
	"otp_required_for_login" boolean,
	"otp_secret" varchar,
	"last_otp_timestep" integer,
	"otp_backup_codes" text,
	"preferences" jsonb,
	"name" varchar GENERATED ALWAYS AS ((((first_name)::text || ' '::text) || (COALESCE(last_name, ''::character varying))::text)) STORED,
	"jti" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "active_storage_variant_records" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"blob_id" bigint NOT NULL,
	"variation_digest" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_charges" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"processor_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"amount_refunded" integer,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"data" jsonb,
	"application_fee_amount" integer,
	"currency" varchar,
	"metadata" jsonb,
	"subscription_id" integer,
	"customer_id" bigint,
	"stripe_account" varchar,
	"type" varchar
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "fk_rails_37ced7af95" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_invitations" ADD CONSTRAINT "fk_rails_04a176d6ed" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_invitations" ADD CONSTRAINT "fk_rails_7a9e106543" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_users" ADD CONSTRAINT "fk_rails_685e030c15" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_users" ADD CONSTRAINT "fk_rails_c96445f213" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "fk_rails_f16b5e0447" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_payment_methods" ADD CONSTRAINT "fk_rails_c78c6cb84d" FOREIGN KEY ("customer_id") REFERENCES "public"."pay_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_subscriptions" ADD CONSTRAINT "fk_rails_b7cd64d378" FOREIGN KEY ("customer_id") REFERENCES "public"."pay_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_storage_variant_records" ADD CONSTRAINT "fk_rails_993965df05" FOREIGN KEY ("blob_id") REFERENCES "public"."active_storage_blobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_charges" ADD CONSTRAINT "fk_rails_b19d32f835" FOREIGN KEY ("customer_id") REFERENCES "public"."pay_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "index_accounts_on_owner_id" ON "accounts" USING btree ("owner_id" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_account_invitations_on_account_id_and_email" ON "account_invitations" USING btree ("account_id" int8_ops,"email" int8_ops);--> statement-breakpoint
CREATE INDEX "index_account_invitations_on_invited_by_id" ON "account_invitations" USING btree ("invited_by_id" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_account_invitations_on_token" ON "account_invitations" USING btree ("token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_account_users_on_account_id_and_user_id" ON "account_users" USING btree ("account_id" int8_ops,"user_id" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_active_storage_blobs_on_key" ON "active_storage_blobs" USING btree ("key" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_action_text_rich_texts_uniqueness" ON "action_text_rich_texts" USING btree ("record_type" int8_ops,"record_id" int8_ops,"name" int8_ops);--> statement-breakpoint
CREATE INDEX "index_active_storage_attachments_on_blob_id" ON "active_storage_attachments" USING btree ("blob_id" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_active_storage_attachments_uniqueness" ON "active_storage_attachments" USING btree ("record_type" int8_ops,"record_id" int8_ops,"name" int8_ops,"blob_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_cloudflare_firewall_rules_on_account_id" ON "cloudflare_firewall_rules" USING btree ("account_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_cloudflare_firewall_rules_on_blocked_at" ON "cloudflare_firewall_rules" USING btree ("blocked_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_cloudflare_firewall_rules_on_cloudflare_rule_id" ON "cloudflare_firewall_rules" USING btree ("cloudflare_rule_id" text_ops);--> statement-breakpoint
CREATE INDEX "index_cloudflare_firewall_rules_on_created_at" ON "cloudflare_firewall_rules" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_cloudflare_firewall_rules_on_domain_id" ON "cloudflare_firewall_rules" USING btree ("domain_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_cloudflare_firewall_rules_on_firewall_id" ON "cloudflare_firewall_rules" USING btree ("firewall_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_cloudflare_firewall_rules_on_status" ON "cloudflare_firewall_rules" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "index_cloudflare_firewall_rules_on_unblocked_at" ON "cloudflare_firewall_rules" USING btree ("unblocked_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_cloudflare_firewalls_on_account_id" ON "cloudflare_firewalls" USING btree ("account_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_cloudflare_firewalls_on_blocked_at" ON "cloudflare_firewalls" USING btree ("blocked_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_cloudflare_firewalls_on_created_at" ON "cloudflare_firewalls" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_cloudflare_firewalls_on_status" ON "cloudflare_firewalls" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "index_cloudflare_firewalls_on_unblocked_at" ON "cloudflare_firewalls" USING btree ("unblocked_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_api_tokens_on_token" ON "api_tokens" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "index_api_tokens_on_user_id" ON "api_tokens" USING btree ("user_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_connected_accounts_on_owner_id_and_owner_type" ON "connected_accounts" USING btree ("owner_id" int8_ops,"owner_type" int8_ops);--> statement-breakpoint
CREATE INDEX "index_deploy_files_on_created_at" ON "deploy_files" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_deploy_files_on_deploy_id" ON "deploy_files" USING btree ("deploy_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_deploy_files_on_website_file_id" ON "deploy_files" USING btree ("website_file_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_created_at" ON "deploys" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_environment" ON "deploys" USING btree ("environment" text_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_is_live" ON "deploys" USING btree ("is_live" bool_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_is_preview" ON "deploys" USING btree ("is_preview" bool_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_revertible" ON "deploys" USING btree ("revertible" bool_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_shasum" ON "deploys" USING btree ("shasum" text_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_snapshot_id" ON "deploys" USING btree ("snapshot_id" text_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_status" ON "deploys" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_trigger" ON "deploys" USING btree ("trigger" text_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_website_history_id" ON "deploys" USING btree ("website_history_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_website_id" ON "deploys" USING btree ("website_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_website_id_and_environment_and_is_preview" ON "deploys" USING btree ("website_id" int8_ops,"environment" int8_ops,"is_preview" int8_ops);--> statement-breakpoint
CREATE INDEX "index_deploys_on_website_id_and_is_live" ON "deploys" USING btree ("website_id" int8_ops,"is_live" int8_ops);--> statement-breakpoint
CREATE INDEX "index_domains_on_account_id" ON "domains" USING btree ("account_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_domains_on_cloudflare_zone_id" ON "domains" USING btree ("cloudflare_zone_id" text_ops);--> statement-breakpoint
CREATE INDEX "index_domains_on_created_at" ON "domains" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_domains_on_domain" ON "domains" USING btree ("domain" text_ops);--> statement-breakpoint
CREATE INDEX "index_domains_on_website_id" ON "domains" USING btree ("website_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_file_specifications_on_canonical_path" ON "file_specifications" USING btree ("canonical_path" text_ops);--> statement-breakpoint
CREATE INDEX "index_file_specifications_on_filetype" ON "file_specifications" USING btree ("filetype" text_ops);--> statement-breakpoint
CREATE INDEX "index_file_specifications_on_componentType" ON "file_specifications" USING btree ("componentType" text_ops);--> statement-breakpoint
CREATE INDEX "idx_icon_embeddings_text" ON "icon_embeddings" USING ivfflat ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_icon_embeddings_on_key" ON "icon_embeddings" USING btree ("key" text_ops);--> statement-breakpoint
CREATE INDEX "index_noticed_events_on_account_id" ON "noticed_events" USING btree ("account_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_noticed_events_on_record" ON "noticed_events" USING btree ("record_type" int8_ops,"record_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_noticed_notifications_on_account_id" ON "noticed_notifications" USING btree ("account_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_noticed_notifications_on_event_id" ON "noticed_notifications" USING btree ("event_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_noticed_notifications_on_recipient" ON "noticed_notifications" USING btree ("recipient_type" int8_ops,"recipient_id" text_ops);--> statement-breakpoint
CREATE INDEX "index_notification_tokens_on_user_id" ON "notification_tokens" USING btree ("user_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_notifications_on_account_id" ON "notifications" USING btree ("account_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_notifications_on_recipient_type_and_recipient_id" ON "notifications" USING btree ("recipient_type" int8_ops,"recipient_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_pages_on_created_at" ON "pages" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_pages_on_file_id" ON "pages" USING btree ("file_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_pages_on_project_id" ON "pages" USING btree ("project_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_pages_on_project_id_and_page_type" ON "pages" USING btree ("project_id" text_ops,"page_type" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_pay_payment_methods_on_customer_id_and_processor_id" ON "pay_payment_methods" USING btree ("customer_id" int8_ops,"processor_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_pay_merchants_on_owner_type_and_owner_id_and_processor" ON "pay_merchants" USING btree ("owner_type" text_ops,"owner_id" int8_ops,"processor" text_ops);--> statement-breakpoint
CREATE INDEX "customer_owner_processor_index" ON "pay_customers" USING btree ("owner_type" int8_ops,"owner_id" timestamp_ops,"deleted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_pay_customers_on_processor_and_processor_id" ON "pay_customers" USING btree ("processor" text_ops,"processor_id" text_ops);--> statement-breakpoint
CREATE INDEX "index_plan_limits_on_created_at" ON "plan_limits" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_plan_limits_on_limit" ON "plan_limits" USING btree ("limit" int4_ops);--> statement-breakpoint
CREATE INDEX "index_plan_limits_on_limit_type" ON "plan_limits" USING btree ("limit_type" text_ops);--> statement-breakpoint
CREATE INDEX "index_plan_limits_on_plan_id" ON "plan_limits" USING btree ("plan_id" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_plan_limits_on_plan_id_and_limit_type" ON "plan_limits" USING btree ("plan_id" text_ops,"limit_type" text_ops);--> statement-breakpoint
CREATE INDEX "index_plans_on_created_at" ON "plans" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_plans_on_name" ON "plans" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "index_project_plans_on_created_at" ON "project_plans" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_project_plans_on_project_id" ON "project_plans" USING btree ("project_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_project_plans_on_updated_at" ON "project_plans" USING btree ("updated_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_projects_on_account_id" ON "projects" USING btree ("account_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_projects_on_account_id_and_created_at" ON "projects" USING btree ("account_id" int8_ops,"created_at" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_projects_on_account_id_and_name" ON "projects" USING btree ("account_id" text_ops,"name" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_projects_on_account_id_and_thread_id" ON "projects" USING btree ("account_id" int8_ops,"thread_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_projects_on_account_id_and_updated_at" ON "projects" USING btree ("account_id" int8_ops,"updated_at" int8_ops);--> statement-breakpoint
CREATE INDEX "index_projects_on_created_at" ON "projects" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_projects_on_name" ON "projects" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "index_projects_on_theme_id" ON "projects" USING btree ("theme_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_projects_on_thread_id" ON "projects" USING btree ("thread_id" text_ops);--> statement-breakpoint
CREATE INDEX "index_projects_on_updated_at" ON "projects" USING btree ("updated_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_sections_on_component_id" ON "sections" USING btree ("component_id" text_ops);--> statement-breakpoint
CREATE INDEX "index_sections_on_created_at" ON "sections" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_sections_on_file_id" ON "sections" USING btree ("file_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_sections_on_page_id" ON "sections" USING btree ("page_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_template_files_on_path" ON "template_files" USING btree ("path" text_ops);--> statement-breakpoint
CREATE INDEX "index_template_files_on_shasum" ON "template_files" USING btree ("shasum" text_ops);--> statement-breakpoint
CREATE INDEX "index_template_files_on_template_id" ON "template_files" USING btree ("template_id" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_template_files_on_template_id_and_path" ON "template_files" USING btree ("template_id" text_ops,"path" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_templates_on_name" ON "templates" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "index_theme_labels_on_name" ON "theme_labels" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_pay_subscriptions_on_customer_id_and_processor_id" ON "pay_subscriptions" USING btree ("customer_id" text_ops,"processor_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_pay_subscriptions_on_metered" ON "pay_subscriptions" USING btree ("metered" bool_ops);--> statement-breakpoint
CREATE INDEX "index_pay_subscriptions_on_pause_starts_at" ON "pay_subscriptions" USING btree ("pause_starts_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_themes_on_name" ON "themes" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "index_themes_to_theme_labels_on_theme_id" ON "themes_to_theme_labels" USING btree ("theme_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_themes_to_theme_labels_on_theme_id_and_theme_label_id" ON "themes_to_theme_labels" USING btree ("theme_id" int8_ops,"theme_label_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_themes_to_theme_labels_on_theme_label_id" ON "themes_to_theme_labels" USING btree ("theme_label_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_website_file_histories_on_created_at" ON "website_file_histories" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_website_file_histories_on_file_specification_id" ON "website_file_histories" USING btree ("file_specification_id" int4_ops);--> statement-breakpoint
CREATE INDEX "index_website_file_histories_on_history_ended_at" ON "website_file_histories" USING btree ("history_ended_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_website_file_histories_on_history_started_at" ON "website_file_histories" USING btree ("history_started_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_website_file_histories_on_history_user_id" ON "website_file_histories" USING btree ("history_user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "index_website_file_histories_on_shasum" ON "website_file_histories" USING btree ("shasum" text_ops);--> statement-breakpoint
CREATE INDEX "index_website_file_histories_on_snapshot_id" ON "website_file_histories" USING btree ("snapshot_id" text_ops);--> statement-breakpoint
CREATE INDEX "index_website_file_histories_on_updated_at" ON "website_file_histories" USING btree ("updated_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_website_file_histories_on_website_file_id" ON "website_file_histories" USING btree ("website_file_id" int4_ops);--> statement-breakpoint
CREATE INDEX "index_website_file_histories_on_website_id" ON "website_file_histories" USING btree ("website_id" int4_ops);--> statement-breakpoint
CREATE INDEX "index_website_files_on_created_at" ON "website_files" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_website_files_on_file_specification_id" ON "website_files" USING btree ("file_specification_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_website_files_on_shasum" ON "website_files" USING btree ("shasum" text_ops);--> statement-breakpoint
CREATE INDEX "index_website_files_on_updated_at" ON "website_files" USING btree ("updated_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_website_files_on_website_id" ON "website_files" USING btree ("website_id" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_website_files_on_website_id_and_path_unique" ON "website_files" USING btree ("website_id" text_ops,"path" text_ops);--> statement-breakpoint
CREATE INDEX "index_website_histories_on_account_id" ON "website_histories" USING btree ("account_id" int4_ops);--> statement-breakpoint
CREATE INDEX "index_website_histories_on_created_at" ON "website_histories" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_website_histories_on_history_ended_at" ON "website_histories" USING btree ("history_ended_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_website_histories_on_history_started_at" ON "website_histories" USING btree ("history_started_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_website_histories_on_history_user_id" ON "website_histories" USING btree ("history_user_id" int4_ops);--> statement-breakpoint
CREATE INDEX "index_website_histories_on_name" ON "website_histories" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "index_website_histories_on_project_id" ON "website_histories" USING btree ("project_id" int4_ops);--> statement-breakpoint
CREATE INDEX "index_website_histories_on_snapshot_id" ON "website_histories" USING btree ("snapshot_id" text_ops);--> statement-breakpoint
CREATE INDEX "index_website_histories_on_template_id" ON "website_histories" USING btree ("template_id" int4_ops);--> statement-breakpoint
CREATE INDEX "index_website_histories_on_thread_id" ON "website_histories" USING btree ("thread_id" text_ops);--> statement-breakpoint
CREATE INDEX "index_website_histories_on_website_id" ON "website_histories" USING btree ("website_id" int4_ops);--> statement-breakpoint
CREATE INDEX "index_websites_on_account_id" ON "websites" USING btree ("account_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_websites_on_created_at" ON "websites" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "index_websites_on_name" ON "websites" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "index_websites_on_project_id" ON "websites" USING btree ("project_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_websites_on_template_id" ON "websites" USING btree ("template_id" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_websites_on_thread_id" ON "websites" USING btree ("thread_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_users_on_email" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_users_on_invitation_token" ON "users" USING btree ("invitation_token" text_ops);--> statement-breakpoint
CREATE INDEX "index_users_on_invitations_count" ON "users" USING btree ("invitations_count" int4_ops);--> statement-breakpoint
CREATE INDEX "index_users_on_invited_by_id" ON "users" USING btree ("invited_by_id" int8_ops);--> statement-breakpoint
CREATE INDEX "index_users_on_invited_by_type_and_invited_by_id" ON "users" USING btree ("invited_by_type" text_ops,"invited_by_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_users_on_jti" ON "users" USING btree ("jti" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_users_on_reset_password_token" ON "users" USING btree ("reset_password_token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_active_storage_variant_records_uniqueness" ON "active_storage_variant_records" USING btree ("blob_id" int8_ops,"variation_digest" int8_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "index_pay_charges_on_customer_id_and_processor_id" ON "pay_charges" USING btree ("customer_id" int8_ops,"processor_id" int8_ops);
*/