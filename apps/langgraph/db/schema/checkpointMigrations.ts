import { pgTable, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const checkpointMigrations = pgTable('checkpoint_migrations', {
  v: integer('v').primaryKey(),
});

export const checkpointMigrationsSchema = createInsertSchema(checkpointMigrations);
export type CheckpointMigrationsSchema = z.infer<typeof checkpointMigrationsSchema>;