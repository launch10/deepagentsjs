/**
 * Website Builder Error Recovery Test
 *
 * Verifies that when the coding agent fails mid-edit (after writing some files
 * to the virtual filesystem but before flush), the frontend receives:
 * - An error message (not a crash)
 * - The ORIGINAL files from the database (not partial/corrupted files)
 *
 * This exercises the full safety chain:
 * 1. createCodingAgent durability wrapper catches errors → returns fallback message
 * 2. flush() never runs (agent.invoke() didn't succeed) → DB untouched
 * 3. websiteBuilderNode sees no new files → doesn't return partial state
 * 4. syncWebsiteChangesNode ALWAYS runs → reads original files from DB → frontend safe
 *
 * Usage:
 *   cd langgraph_app
 *   pnpm test tests/tests/graphs/website/websiteErrorRecovery.test.ts
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
  db,
  websites,
  websiteFiles,
  chats,
  eq,
  and,
} from "@db";
import { testGraph } from "@support";
import { DatabaseSnapshotter, WebsiteFilesBackend } from "@services";
import { getCodingAgentBackend } from "@nodes";
import { Website, type ThreadIDType } from "@types";
import { graphParams } from "@core";
import type { WebsiteGraphState } from "@annotation";
import { toStructuredMessages } from "langgraph-ai-sdk";

// ─────────────────────────────────────────────────────────────────────────────
// Hoisted mock — accessible inside vi.mock factory
// ─────────────────────────────────────────────────────────────────────────────
const { createCodingAgentMock } = vi.hoisted(() => ({
  createCodingAgentMock: vi.fn(),
}));

// Mock the SOURCE module (not the barrel). The barrel's export chain
// processes "export * from ./coding" (line 3 of @nodes/index.ts) BEFORE
// "export * from ./website" (line 6), so when websiteBuilder.ts loads and
// imports createCodingAgent from @nodes, it gets the mock. This pattern
// is already used in singleShotEdit.unit.test.ts.
vi.mock("../../../../app/nodes/coding/agent", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original, // keeps getCodingAgentBackend, getTheme, etc. real
    createCodingAgent: createCodingAgentMock,
  };
});

// Import the graph AFTER mock registration — barrel re-exports pick up the mock
import { websiteGraph as uncompiledGraph } from "@graphs";

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

describe("Website Builder Error Recovery", () => {
  let websiteId: number;
  let threadId: ThreadIDType;
  let originalFiles: Map<string, string>;

  beforeEach(async () => {
    // website_generated snapshot: fully built website with files in DB
    await DatabaseSnapshotter.restoreSnapshot("website_generated");
    const ctx = await getWebsiteContext();
    websiteId = ctx.websiteId;
    threadId = ctx.threadId;

    // Capture original files for comparison
    const rows = await db
      .select()
      .from(websiteFiles)
      .where(eq(websiteFiles.websiteId, websiteId));
    originalFiles = new Map(rows.map((f) => [f.path!, f.content]));
    expect(originalFiles.size).toBeGreaterThan(0);
  }, 60000);

  it("preserves original files when coding agent writes files then crashes before flush", async () => {
    // Configure mock: simulate a realistic failure scenario.
    // The agent creates a backend, writes 1-2 files to the virtual FS,
    // then crashes. The durability wrapper in createCodingAgent catches
    // the error and returns a fallback message — but flush() never ran,
    // so the DB is untouched.
    createCodingAgentMock.mockImplementation(async (state: any) => {
      // 1. Create a REAL backend — writes go to the virtual filesystem
      const backend = await getCodingAgentBackend(state);

      // 2. Agent writes modified files (virtual FS only, not flushed to DB)
      await backend.write("src/components/Hero.tsx", `
        export default function Hero() {
          return <div>CORRUPTED PARTIAL WRITE — agent crashed here</div>;
        }
      `);
      await backend.write("src/components/CTA.tsx", `
        export default function CTA() {
          return <div>ANOTHER CORRUPTED WRITE</div>;
        }
      `);

      // 3. Verify dirty paths exist (files were written to virtual FS)
      expect(backend.hasDirtyFiles()).toBe(true);
      expect(backend.getDirtyPaths().length).toBe(2);

      // 4. DO NOT call backend.flush() — simulates the agent crashing
      //    before flush runs (which is what happens when agent.invoke() throws)

      // 5. Clean up the virtual FS (the real code does this in afterAll)
      await backend.cleanup();

      // 6. Return what the durability wrapper returns on error:
      //    a fallback message with NO files property
      return {
        messages: await toStructuredMessages([
          new AIMessage({
            content:
              "I ran into an issue processing your request. Could you try again? If the problem persists, try rephrasing your request.",
          }),
        ]),
        status: "completed",
      };
    });

    // Run the full compiled website graph (edit flow)
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
          new HumanMessage("Make the hero section more colorful and vibrant"),
        ],
      })
      .execute();

    // ── Assertion 1: Graph completed without throwing ──
    expect(result.error).toBeUndefined();

    // ── Assertion 2: Mock was called (graph reached websiteBuilderNode) ──
    expect(createCodingAgentMock).toHaveBeenCalled();

    // ── Assertion 3: User sees the error message ──
    const aiMessages = result.state.messages.filter(
      (m: any) => m._getType?.() === "ai" || m.type === "ai"
    );
    const lastAiContent = aiMessages
      .flatMap((m: any) => {
        if (typeof m.content === "string") return [m.content];
        if (Array.isArray(m.content)) return m.content.filter((c: any) => c.type === "text").map((c: any) => c.text);
        return [];
      })
      .join(" ");

    expect(lastAiContent).toContain("ran into an issue");

    // ── Assertion 4: KEY — Files in state match the ORIGINAL DB files ──
    // syncWebsiteChangesNode ran and returned the pre-error files
    const stateFiles = result.state.files;
    expect(Object.keys(stateFiles).length).toBeGreaterThan(0);

    for (const [path, originalContent] of originalFiles) {
      const stateFile = stateFiles[path] as Website.File.File | undefined;
      expect(stateFile).toBeDefined();
      expect(stateFile!.content).toEqual(originalContent);
    }

    // Specifically verify the "corrupted" content did NOT leak through
    const heroFile = stateFiles["src/components/Hero.tsx"] as Website.File.File | undefined;
    if (heroFile) {
      expect(heroFile.content).not.toContain("CORRUPTED PARTIAL WRITE");
    }

    const ctaFile = stateFiles["src/components/CTA.tsx"] as Website.File.File | undefined;
    if (ctaFile) {
      expect(ctaFile.content).not.toContain("ANOTHER CORRUPTED WRITE");
    }

    // ── Assertion 5: DB website_files rows are completely unchanged ──
    const dbFilesAfter = await db
      .select()
      .from(websiteFiles)
      .where(eq(websiteFiles.websiteId, websiteId));

    const afterContent = new Map(dbFilesAfter.map((f) => [f.path!, f.content]));
    expect(afterContent.size).toEqual(originalFiles.size);

    for (const [path, content] of originalFiles) {
      expect(afterContent.get(path)).toEqual(content);
    }
  }, 120000);
});
