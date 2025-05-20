CREATE TABLE "file_specifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_path" text NOT NULL,
	"description" text NOT NULL,
	"filetype" integer NOT NULL,
	"subtype" text NOT NULL,
	"language" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "file_specifications_subtype_idx" UNIQUE("subtype")
);
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "file_specification_id" integer NOT NULL;--> statement-breakpoint
CREATE INDEX "file_specifications_filetype_idx" ON "file_specifications" USING btree ("filetype");--> statement-breakpoint
CREATE INDEX "file_specifications_canonical_path_idx" ON "file_specifications" USING btree ("canonical_path");--> statement-breakpoint
CREATE INDEX "files_file_specification_id_idx" ON "files" USING btree ("file_specification_id");