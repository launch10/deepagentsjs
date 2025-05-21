import { pgTable, text, customType, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const checkpoints = pgTable('checkpoints', {
  threadId: text('thread_id').notNull(),
  checkpointNs: text('checkpoint_ns').notNull().default(''),
  checkpointId: text('checkpoint_id').notNull(),
  parentCheckpointId: text('parent_checkpoint_id'),
  type: text('type'),
  checkpoint: jsonb('checkpoint').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
}, (table) => {
  return {
    pk: {
      name: 'checkpoints_pkey',
      columns: [table.threadId, table.checkpointNs, table.checkpointId],
    },
  };
});

export const checkpointsSchema = createInsertSchema(checkpoints);
export type CheckpointsSchema = z.infer<typeof checkpointsSchema>;