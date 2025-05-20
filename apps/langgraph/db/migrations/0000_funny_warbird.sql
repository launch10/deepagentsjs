CREATE TABLE "checkpoint_blobs" (
	"thread_id" text NOT NULL,
	"checkpoint_ns" text DEFAULT '' NOT NULL,
	"channel" text NOT NULL,
	"version" text NOT NULL,
	"type" text NOT NULL,
	"blob" "bytea"
);
--> statement-breakpoint
CREATE TABLE "checkpoint_migrations" (
	"v" integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkpoint_writes" (
	"thread_id" text NOT NULL,
	"checkpoint_ns" text DEFAULT '' NOT NULL,
	"checkpoint_id" text NOT NULL,
	"task_id" text NOT NULL,
	"idx" integer NOT NULL,
	"channel" text NOT NULL,
	"type" text,
	"blob" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkpoints" (
	"thread_id" text NOT NULL,
	"checkpoint_ns" text DEFAULT '' NOT NULL,
	"checkpoint_id" text NOT NULL,
	"parent_checkpoint_id" text,
	"type" text,
	"checkpoint" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icon_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(1536),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "icon_embeddings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "icon_query_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"results" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"use_count" integer DEFAULT 1 NOT NULL,
	"ttl_seconds" integer DEFAULT 86400 NOT NULL,
	"min_similarity" real DEFAULT 0.7 NOT NULL,
	"top_k" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"project_id" integer NOT NULL,
	"file_path" text NOT NULL,
	"page_type" text NOT NULL,
	"content_plan" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_name" text NOT NULL,
	"tenant_id" bigint NOT NULL,
	"project_mode" text NOT NULL,
	"root_path" text NOT NULL,
	"backup_path" text NOT NULL,
	"project_plan" jsonb NOT NULL,
	"theme_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"project_id" integer NOT NULL,
	"page_id" integer NOT NULL,
	"component_id" text NOT NULL,
	"section_type" text NOT NULL,
	"file_path" text NOT NULL,
	"content_plan" jsonb NOT NULL,
	"theme" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"colors" jsonb NOT NULL,
	"theme" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme_labels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "themes_to_theme_labels" (
	"theme_id" integer NOT NULL,
	"theme_label_id" integer NOT NULL,
	CONSTRAINT "themes_to_theme_labels_theme_id_theme_label_id_pk" PRIMARY KEY("theme_id","theme_label_id")
);
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes_to_theme_labels" ADD CONSTRAINT "themes_to_theme_labels_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes_to_theme_labels" ADD CONSTRAINT "themes_to_theme_labels_theme_label_id_theme_labels_id_fk" FOREIGN KEY ("theme_label_id") REFERENCES "public"."theme_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "icon_embedding_idx" ON "icon_embeddings" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists=100);--> statement-breakpoint
CREATE INDEX "icon_text_idx" ON "icon_embeddings" USING btree ("text");--> statement-breakpoint
CREATE INDEX "icon_query_cache_query_idx" ON "icon_query_cache" USING btree ("query");--> statement-breakpoint
CREATE INDEX "pages_project_id_idx" ON "pages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pages_file_path_idx" ON "pages" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "projects_theme_id_idx" ON "projects" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "projects_tenant_id_idx" ON "projects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "projects_project_name_idx" ON "projects" USING btree ("project_name");--> statement-breakpoint
CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "projects_updated_at_idx" ON "projects" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "sections_project_id_idx" ON "sections" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "sections_page_id_idx" ON "sections" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "sections_component_id_idx" ON "sections" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "sections_section_type_idx" ON "sections" USING btree ("section_type");--> statement-breakpoint
CREATE INDEX "sections_file_path_idx" ON "sections" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "tenants_name_idx" ON "tenants" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "palette_name_idx" ON "themes" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "theme_label_name_idx" ON "theme_labels" USING btree ("name");