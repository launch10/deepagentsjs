ALTER TABLE "sections" DROP CONSTRAINT "sections_project_id_projects_id_fk";
--> statement-breakpoint
DROP INDEX "sections_project_id_idx";--> statement-breakpoint
ALTER TABLE "sections" DROP COLUMN "project_id";