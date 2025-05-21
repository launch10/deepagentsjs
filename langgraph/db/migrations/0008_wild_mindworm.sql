ALTER TABLE "files" DROP CONSTRAINT "files_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "pages_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "pages_file_id_files_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_theme_id_themes_id_fk";
--> statement-breakpoint
ALTER TABLE "sections" DROP CONSTRAINT "sections_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "sections" DROP CONSTRAINT "sections_file_id_files_id_fk";
--> statement-breakpoint
ALTER TABLE "themes_to_theme_labels" DROP CONSTRAINT "themes_to_theme_labels_theme_id_themes_id_fk";
--> statement-breakpoint
ALTER TABLE "themes_to_theme_labels" DROP CONSTRAINT "themes_to_theme_labels_theme_label_id_theme_labels_id_fk";
