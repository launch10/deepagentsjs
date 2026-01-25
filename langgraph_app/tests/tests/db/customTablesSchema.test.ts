import { describe, it, expect } from "vitest";
import { db, sql, eq, llmConversationTraces } from "@db";
import { getTableColumns } from "drizzle-orm";

/**
 * Schema Validation Tests
 *
 * These tests verify that custom-tables.ts matches the actual database schema.
 * If these fail, custom-tables.ts has drifted from the Rails migrations.
 *
 * To fix: Update custom-tables.ts to match the Rails migration.
 * @see rails_app/db/migrate/20260123211228_create_llm_conversation_traces.rb
 */

describe("custom-tables.ts Schema Validation", () => {
  describe("llmConversationTraces", () => {
    it("table exists in database", async () => {
      const result = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'llm_conversation_traces'
          AND n.nspname = 'public'
        ) as exists
      `);
      expect(result[0]?.exists).toBe(true);
    });

    it("Drizzle columns match database columns", async () => {
      // Get columns from Drizzle definition
      const drizzleColumns = Object.keys(getTableColumns(llmConversationTraces)).sort();

      // Get columns from database
      const result = await db.execute<{ column_name: string }>(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'llm_conversation_traces'
        AND table_schema = 'public'
        ORDER BY column_name
      `);

      const dbColumns = [...result]
        .map((row) => {
          // Convert snake_case to camelCase to match Drizzle
          return row.column_name.replace(/_([a-z])/g, (_: string, letter: string) =>
            letter.toUpperCase()
          );
        })
        .sort();

      expect(drizzleColumns).toEqual(dbColumns);
    });

    it("can insert and query (partition routing works)", async () => {
      const testRunId = `schema-test-${Date.now()}`;

      try {
        // Insert via parent table
        await db.insert(llmConversationTraces).values({
          chatId: 1,
          threadId: "test-thread",
          runId: testRunId,
          graphName: "test",
          messages: [{ type: "test", content: "test" }],
          systemPrompt: "test prompt",
          usageSummary: { totalInputTokens: 0, totalOutputTokens: 0, llmCallCount: 0 },
          createdAt: new Date().toISOString(),
        });

        // Query back via parent table using Drizzle
        const rows = await db
          .select()
          .from(llmConversationTraces)
          .where(eq(llmConversationTraces.runId, testRunId));

        expect(rows.length).toBe(1);
        expect(rows[0]?.runId).toBe(testRunId);
      } finally {
        // Cleanup
        await db
          .delete(llmConversationTraces)
          .where(eq(llmConversationTraces.runId, testRunId));
      }
    });
  });
});
