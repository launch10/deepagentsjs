/**
 * Website Builder File Return Tests
 *
 * Verifies the file-return behavior of websiteBuilderNode and the graph:
 *
 * 1. Template file guard: websiteBuilderNode must NOT return template files
 *    when the agent hasn't written to website_files. The codeFiles view
 *    includes template_files as fallback — without the guard, "Hello world"
 *    template content leaks into state prematurely.
 *
 * 2. Agent file return: when website_files has records (agent wrote files),
 *    websiteBuilderNode returns the full file set (agent + template fallbacks)
 *    immediately — before compaction/cleanup/syncFiles.
 *
 * 3. File persistence: after a full graph run, files are persisted to the
 *    website_files table and accessible in the final checkpoint state.
 *
 * 4. Edit file state: after an edit, state.files reflects the updated content.
 *
 * Usage:
 *   cd langgraph_app
 *   LAUNCH10_ENV=test pnpm vitest run tests/tests/graphs/website/websiteBuilderFiles.test.ts
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { db, websites, websiteFiles, codeFiles, chats, eq, and } from "@db";
import { testGraph, consumeStream } from "@support";
import { DatabaseSnapshotter } from "@services";
import { WebsiteAPI } from "@api";
import { getCodingAgentBackend } from "@nodes";
import { startPolly, stopPolly, persistRecordings } from "@utils";
import { Website, type ThreadIDType } from "@types";
import { websiteGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import type { WebsiteGraphState } from "@annotation";

const websiteGraph = uncompiledGraph.compile({
  ...graphParams,
  name: "website",
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getWebsiteContext() {
  const [website] = await db.select().from(websites).limit(1);
  if (!website) throw new Error("No website found in snapshot");

  const [chat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.contextableId, website.id), eq(chats.contextableType, "Website")))
    .limit(1);

  if (!chat?.threadId) throw new Error("No chat with threadId found");

  return {
    website,
    websiteId: website.id,
    threadId: chat.threadId as ThreadIDType,
    accountId: website.accountId ?? undefined,
    projectId: website.projectId ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Website Builder File Return Behavior", () => {
  /**
   * Test the codeFiles view behavior directly.
   * This confirms the root cause: codeFiles returns template files
   * even when no website_files exist.
   */
  describe("codeFiles view vs websiteFiles table", () => {
    let websiteId: number;

    beforeEach(async () => {
      // website_step snapshot has a website with a template but NO generated files
      await DatabaseSnapshotter.restoreSnapshot("website_step");
      const [website] = await db.select().from(websites).limit(1);
      if (!website) throw new Error("No website found");
      websiteId = website.id;

      // Ensure clean state: delete any website_files that may have leaked into the snapshot
      await db.delete(websiteFiles).where(eq(websiteFiles.websiteId, websiteId));
    });

    it("codeFiles view returns template files even when no website_files exist", async () => {
      // Verify no website_files exist for this website
      const wfRows = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId))
        .limit(1);
      expect(wfRows.length).toBe(0);

      // But codeFiles view DOES return files (from template_files fallback)
      const cfRows = await db.select().from(codeFiles).where(eq(codeFiles.websiteId, websiteId));

      expect(cfRows.length).toBeGreaterThan(0);

      // These are template files — this is the "Hello world" leak we guard against
      console.log(
        `codeFiles returned ${cfRows.length} files with no website_files records (all template fallbacks)`
      );
    });

    it("websiteFiles table is empty for a new website", async () => {
      const rows = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));
      expect(rows.length).toBe(0);
    });
  });

  describe("codeFiles view with existing website_files", () => {
    let websiteId: number;

    beforeEach(async () => {
      // website_generated snapshot has a website with agent-written files
      await DatabaseSnapshotter.restoreSnapshot("website_generated");
      const [website] = await db.select().from(websites).limit(1);
      if (!website) throw new Error("No website found");
      websiteId = website.id;
    });

    it("websiteFiles table has records after agent generation", async () => {
      const rows = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      expect(rows.length).toBeGreaterThan(0);

      const componentFiles = rows.filter((f) => f.path?.includes("src/components"));
      expect(componentFiles.length).toBeGreaterThanOrEqual(2);

      console.log(`website_files has ${rows.length} records (${componentFiles.length} components)`);
    });

    it("codeFiles view returns agent content, not template content", async () => {
      const cfRows = await db.select().from(codeFiles).where(eq(codeFiles.websiteId, websiteId));

      expect(cfRows.length).toBeGreaterThan(0);

      // Agent-written components should contain React exports, not template boilerplate
      const heroFile = cfRows.find((f) => f.path?.toLowerCase().includes("hero"));
      if (heroFile) {
        expect(heroFile.content).toContain("export");
        // Should NOT be template "Hello world" content
        expect(heroFile.content).not.toContain("Hello world");
      }
    });
  });

  /**
   * Test that files appear in graph state AFTER websiteBuilder node completes
   * during an edit flow. Uses stopAfter to interrupt the graph.
   */
  describe("Files in state after websiteBuilder (edit flow)", () => {
    let websiteId: number;
    let threadId: ThreadIDType;

    beforeEach(async () => {
      await DatabaseSnapshotter.restoreSnapshot("website_generated");
      const ctx = await getWebsiteContext();
      websiteId = ctx.websiteId;
      threadId = ctx.threadId;
    }, 60000);

    afterEach(async () => {
      if (websiteId) {
        try {
          const backend = await getCodingAgentBackend({
            websiteId,
            jwt: "test-jwt",
          } as WebsiteGraphState);
          await backend.cleanup();
        } catch {}
      }
    });

    it("returns files in state after websiteBuilder node (not just after syncFiles)", async () => {
      // Run graph but stop after websiteBuilder — before compactConversation/syncFiles
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          threadId,
          accountId: 1,
          projectId: 1,
          jwt: "test-jwt",
          messages: [
            new AIMessage("Here's your landing page!"),
            new HumanMessage("Change the hero headline to 'Build Something Amazing'"),
          ],
        })
        .stopAfter("websiteBuilder")
        .execute();

      // Files should already be in state (from websiteBuilderNode, not syncFiles)
      expect(result.state.files).toBeDefined();
      const fileKeys = Object.keys(result.state.files);
      expect(fileKeys.length).toBeGreaterThan(0);

      console.log(
        `Files in state after websiteBuilder: ${fileKeys.length} files ` +
          `(before compaction/cleanup/syncFiles)`
      );

      // Should include component files
      const hasComponents = fileKeys.some((p) => p.includes("src/components"));
      expect(hasComponents).toBe(true);
    }, 300000);

    it("files in state match database content", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          threadId,
          accountId: 1,
          projectId: 1,
          jwt: "test-jwt",
          messages: [
            new AIMessage("Here's your landing page!"),
            new HumanMessage("Make the CTA button text say 'Get Started Free'"),
          ],
        })
        .stopAfter("websiteBuilder")
        .execute();

      // Verify files in state match what's in the database
      const dbFiles = await db.select().from(codeFiles).where(eq(codeFiles.websiteId, websiteId));

      for (const dbFile of dbFiles) {
        const stateFile = result.state.files[dbFile.path!] as Website.File.File | undefined;
        if (stateFile) {
          expect(stateFile.content).toEqual(dbFile.content);
        }
      }
    }, 300000);
  });

  /**
   * Test the full graph flow: files should persist to DB and be in final state.
   */
  describe("File persistence through full graph", () => {
    let websiteId: number;
    let threadId: ThreadIDType;

    beforeEach(async () => {
      await DatabaseSnapshotter.restoreSnapshot("website_generated");
      const ctx = await getWebsiteContext();
      websiteId = ctx.websiteId;
      threadId = ctx.threadId;
    }, 60000);

    afterEach(async () => {
      if (websiteId) {
        try {
          const backend = await getCodingAgentBackend({
            websiteId,
            jwt: "test-jwt",
          } as WebsiteGraphState);
          await backend.cleanup();
        } catch {}
      }
    });

    it("files are persisted to DB and visible in checkpoint after edit", async () => {
      await startPolly("website-builder-file-persistence");

      // Snapshot files before edit
      const filesBefore = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      const beforeContent = new Map(filesBefore.map((f) => [f.path!, f.content]));

      // Run an edit through the full graph
      const response = WebsiteAPI.stream({
        messages: [{ role: "user", content: "Change the hero headline to 'Launch Your Dream'" }],
        threadId,
        state: {
          websiteId,
          threadId,
          accountId: 1,
          projectId: 1,
          jwt: "test-jwt",
          messages: [
            new AIMessage("Here's your landing page!"),
            new HumanMessage("Change the hero headline to 'Launch Your Dream'"),
          ],
        },
      });
      await consumeStream(response);

      await persistRecordings();
      await stopPolly();

      // Verify files are persisted in DB
      const filesAfter = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      expect(filesAfter.length).toBeGreaterThan(0);

      // At least one file should have changed
      const changed = filesAfter.filter((f) => {
        const oldContent = beforeContent.get(f.path!);
        return oldContent !== f.content;
      });

      console.log(`Files changed after edit: ${changed.length} of ${filesAfter.length}`);
      expect(changed.length).toBeGreaterThan(0);

      // Verify checkpoint state also has files
      const checkpoint = await websiteGraph.getState({ configurable: { thread_id: threadId } });
      const state = checkpoint.values as WebsiteGraphState;

      expect(Object.keys(state.files).length).toBeGreaterThan(0);

      // State files should match DB files
      for (const dbFile of filesAfter) {
        const stateFile = state.files[dbFile.path!] as Website.File.File | undefined;
        if (stateFile) {
          expect(stateFile.content).toEqual(dbFile.content);
        }
      }
    }, 300000);
  });
});
