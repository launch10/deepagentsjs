DROP INDEX "pages_file_path_idx";--> statement-breakpoint
DROP INDEX "sections_file_path_idx";--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN "file_path";--> statement-breakpoint
ALTER TABLE "sections" DROP COLUMN "file_path";--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_path_project_id_unique_idx" UNIQUE("path","project_id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_page_type_project_id_unique_idx" UNIQUE("page_type","project_id");