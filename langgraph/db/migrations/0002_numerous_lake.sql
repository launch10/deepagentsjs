ALTER TABLE "pages" ADD COLUMN "file_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "file_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pages_file_id_idx" ON "pages" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "sections_file_id_idx" ON "sections" USING btree ("file_id");