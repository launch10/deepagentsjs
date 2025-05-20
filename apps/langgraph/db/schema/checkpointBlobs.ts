import { pgTable, text, customType } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { bytea } from './types/bytea';

export const checkpointBlobs = pgTable('checkpoint_blobs', {
  threadId: text('thread_id').notNull(),
  checkpointNs: text('checkpoint_ns').notNull().default(''),
  channel: text('channel').notNull(),
  version: text('version').notNull(),
  type: text('type').notNull(),
  blob: bytea('blob'),
}, (table) => {
  return {
    pk: {
      name: 'checkpoint_blobs_pkey',
      columns: [table.threadId, table.checkpointNs, table.channel, table.version],
    },
  };
});

export const checkpointBlobsSchema = createInsertSchema(checkpointBlobs);
export type CheckpointBlobsSchema = z.infer<typeof checkpointBlobsSchema>;