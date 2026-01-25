/**
 * Custom table definitions for tables Drizzle can't introspect.
 *
 * This file is NOT overwritten by `pnpm db:reflect`.
 *
 * SOURCE OF TRUTH: Rails migrations define the actual schema.
 * If you change the Rails migration, update this file to match.
 *
 * VALIDATION: Run `pnpm test tests/tests/db/customTablesSchema.test.ts`
 * to verify this file matches the actual database schema.
 */
import {
  pgTable,
  bigint,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Parent partitioned table for conversation traces.
 *
 * Drizzle introspect only generates child partitions (llm_conversation_traces_2026_01, etc).
 * This parent table is needed for:
 * - INSERTs: PostgreSQL auto-routes to correct partition based on created_at
 * - SELECTs: PostgreSQL scans relevant partitions automatically
 *
 * @see rails_app/db/migrate/20260123211228_create_llm_conversation_traces.rb
 */
export const llmConversationTraces = pgTable(
  "llm_conversation_traces",
  {
    id: bigint({ mode: "number" })
      .default(sql`nextval('llm_conversation_traces_id_seq'::regclass)`)
      .notNull(),
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    threadId: varchar("thread_id").notNull(),
    runId: varchar("run_id").notNull(),
    graphName: varchar("graph_name"),
    messages: jsonb().notNull(),
    systemPrompt: text("system_prompt"),
    usageSummary: jsonb("usage_summary"),
    llmCalls: jsonb("llm_calls"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  },
  (table) => [
    index("llm_conversation_traces_chat_id_created_at_idx").using(
      "btree",
      table.chatId.asc().nullsLast(),
      table.createdAt.asc().nullsLast()
    ),
    uniqueIndex("llm_conversation_traces_run_id_created_at_idx").using(
      "btree",
      table.runId.asc().nullsLast(),
      table.createdAt.asc().nullsLast()
    ),
    index("llm_conversation_traces_thread_id_created_at_idx").using(
      "btree",
      table.threadId.asc().nullsLast(),
      table.createdAt.asc().nullsLast()
    ),
    primaryKey({
      columns: [table.id, table.createdAt],
      name: "llm_conversation_traces_pkey",
    }),
  ]
);
