import { pgTable, text, jsonb, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { bytea } from './types/bytea';

export const checkpointWrites = pgTable('checkpoint_writes', {
  threadId: text('thread_id').notNull(),
  checkpointNs: text('checkpoint_ns').notNull().default(''),
  checkpointId: text('checkpoint_id').notNull(),
  taskId: text('task_id').notNull(),
  idx: integer('idx').notNull(),
  channel: text('channel').notNull(),
  type: text('type'),
  blob: bytea('blob').notNull(),
}, (table) => {
  return {
    pk: {
      name: 'checkpoint_writes_pkey',
      columns: [table.threadId, table.checkpointNs, table.checkpointId, table.taskId, table.idx],
    },
  };
});

export const checkpointWritesSchema = createInsertSchema(checkpointWrites);
export type CheckpointWritesSchema = z.infer<typeof checkpointWritesSchema>;