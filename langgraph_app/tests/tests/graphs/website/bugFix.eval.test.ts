/**
 * Bug Fix Eval Suite
 *
 * Tests whether the coding agent can actually fix real, injected bugs.
 * Each test starts from the known-good `website_generated` snapshot,
 * injects a specific bug, then runs the full coding agent with the same
 * prompt bugFixNode would use.
 *
 * Component inventory (from website_generated snapshot):
 *   Hero.tsx, Features.tsx, CTA.tsx, Footer.tsx, HowItWorks.tsx,
 *   Problem.tsx, SocialProof.tsx, IndexPage.tsx (composition root)
 *
 * Cost budget: ~$0.60-1.80 total (Sonnet, ~$0.10-0.30 per bug fix)
 *
 * Usage:
 *   cd langgraph_app
 *   pnpm test tests/tests/graphs/website/bugFix.eval.test.ts
 *
 *   # Run a single bug fix test:
 *   pnpm test tests/tests/graphs/website/bugFix.eval.test.ts -t "missing-import"
 */
import { describe, it, expect, afterAll } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { db, websites, chats, websiteFiles, llmUsage, eq, and } from "@db";
import { logCostSummary } from "@support";
import { DatabaseSnapshotter } from "@services";
import { createCodingAgent } from "@nodes";
import { buildBugFixPrompt } from "@prompts";
import { usageStorage, createUsageContext, persistUsage, LLMManager } from "@core";
import type { ThreadIDType } from "@types";

// ─────────────────────────────────────────────────────────────────────────────
// Test case definitions
// ─────────────────────────────────────────────────────────────────────────────

interface ContentAssertion {
  /** Substring to match against file path (e.g. "Hero", "IndexPage") */
  file: string;
  /** Text that should (or should not) be present in the file content */
  text: string;
}

interface BugFixTestCase {
  label: string;
  /** Path substring to find the target file in DB (e.g. "IndexPage", "Hero") */
  targetFile: string;
  /** Mutation function: receives original content, returns bugged content */
  injectBug: (content: string) => string;
  /** Error description the agent sees (formatted like RuntimeValidation output) */
  errorDescription: string;
  /** Must be present in the file after fix */
  expectedContains?: ContentAssertion[];
  /** Must NOT be present in the file after fix */
  expectedAbsent?: ContentAssertion[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Bug definitions
// ─────────────────────────────────────────────────────────────────────────────

const BUG_FIX_CASES: BugFixTestCase[] = [
  {
    label: "missing-import",
    targetFile: "IndexPage",
    injectBug: (content: string) => {
      // Add a fake import and usage
      const withImport = content.replace(
        /(import .+ from .+;\n)/,
        `$1import { Fake } from "../components/Fake";\n`
      );
      // Add <Fake /> before the closing tag of the main wrapper
      return withImport.replace(
        /(<\/div>\s*\);\s*}\s*$)/m,
        `  <Fake />\n$1`
      );
    },
    errorDescription:
      "Build error:\nModule not found: Cannot find module '../components/Fake' imported from src/pages/IndexPage.tsx",
    expectedAbsent: [{ file: "IndexPage", text: "Fake" }],
  },
  {
    label: "wrong-import-path",
    targetFile: "IndexPage",
    injectBug: (content: string) => {
      // Change Hero import path to a typo
      return content.replace(
        /from\s+["'](.+\/Hero)["']/,
        `from "../components/Hiro"`
      );
    },
    errorDescription:
      "Build error:\nModule not found: Cannot find module '../components/Hiro' imported from src/pages/IndexPage.tsx\n\nDid you mean '../components/Hero'?",
    expectedContains: [{ file: "IndexPage", text: "Hero" }],
    expectedAbsent: [{ file: "IndexPage", text: "Hiro" }],
  },
  {
    label: "syntax-error-bracket",
    targetFile: "Hero",
    injectBug: (content: string) => {
      // Remove the last ");" to create a syntax error
      const lastIdx = content.lastIndexOf(");");
      if (lastIdx === -1) return content;
      return content.slice(0, lastIdx) + content.slice(lastIdx + 2);
    },
    errorDescription:
      "Build error in src/components/Hero.tsx:\nSyntaxError: Expected ')' but found end of file\n\nThe file appears to have unbalanced parentheses.",
    expectedContains: [{ file: "Hero", text: ");" }],
  },
  {
    label: "undefined-variable",
    targetFile: "Hero",
    injectBug: (content: string) => {
      // Insert {undefinedVar} into the JSX after the first <div
      return content.replace(
        /(<div[^>]*>)/,
        `$1\n        {undefinedVar}`
      );
    },
    errorDescription:
      "Runtime error in src/components/Hero.tsx:\nReferenceError: undefinedVar is not defined\n\nThe variable 'undefinedVar' is referenced in JSX but never declared.",
    expectedAbsent: [{ file: "Hero", text: "undefinedVar" }],
  },
  {
    label: "broken-tailwind-class",
    targetFile: "Hero",
    injectBug: (content: string) => {
      // Replace a valid className with a broken JSX expression
      return content.replace(
        /className="([^"]+)"/,
        `className={styles.heroWrapper}`
      );
    },
    errorDescription:
      "Runtime error in src/components/Hero.tsx:\nReferenceError: styles is not defined\n\nThe component references a 'styles' object that was never imported or defined. This appears to be a CSS modules reference but the project uses Tailwind CSS.",
    expectedAbsent: [{ file: "Hero", text: "styles.heroWrapper" }],
  },
  {
    label: "duplicate-component-render",
    targetFile: "IndexPage",
    injectBug: (content: string) => {
      // Duplicate the <Hero /> render
      return content.replace(
        /(<Hero\s*\/>)/,
        `$1\n        <Hero />`
      );
    },
    errorDescription:
      "Warning: Each child in a list should have a unique \"key\" prop.\n\nMultiple <Hero /> components rendered in IndexPage.tsx. This causes a duplicate key warning and visual duplication on the page.",
    expectedContains: [{ file: "IndexPage", text: "<Hero" }],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

let cumulativeCostMillicredits = 0;

async function getTestContext() {
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

async function snapshotFiles(websiteId: number): Promise<Map<string, string>> {
  const files = await db.select().from(websiteFiles).where(eq(websiteFiles.websiteId, websiteId));
  return new Map(files.map((f) => [f.path!, f.content]));
}

/**
 * Find a file in the map whose path contains the given substring (case-insensitive).
 */
function findFile(files: Map<string, string>, substring: string): string | undefined {
  for (const [path, content] of files) {
    if (path.toLowerCase().includes(substring.toLowerCase())) {
      return content;
    }
  }
  return undefined;
}

/**
 * Find a file path in the map whose path contains the given substring (case-insensitive).
 */
function findFilePath(files: Map<string, string>, substring: string): string | undefined {
  for (const [path] of files) {
    if (path.toLowerCase().includes(substring.toLowerCase())) {
      return path;
    }
  }
  return undefined;
}

/**
 * Check that L10.createLead tracking was not removed from any file that had it.
 * Returns list of violation descriptions (empty = all good).
 */
function checkTrackingPreserved(before: Map<string, string>, after: Map<string, string>): string[] {
  const violations: string[] = [];
  for (const [path, content] of before) {
    if (content.includes("L10.createLead")) {
      const afterContent = after.get(path);
      if (afterContent && !afterContent.includes("L10.createLead")) {
        violations.push(`L10.createLead removed from ${path}`);
      }
    }
    if (content.includes("from '@/lib/tracking'") || content.includes('from "@/lib/tracking"')) {
      const afterContent = after.get(path);
      if (afterContent && !afterContent.includes("tracking")) {
        violations.push(`Tracking import removed from ${path}`);
      }
    }
  }
  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug Fix Eval", () => {
  afterAll(() => {
    console.log("\n━━━ TOTAL BUG FIX EVAL COST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(
      `Total spend: $${(cumulativeCostMillicredits / 100_000).toFixed(4)} ` +
        `(${cumulativeCostMillicredits.toLocaleString()} millicredits)`
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  });

  for (const testCase of BUG_FIX_CASES) {
    it(`[${testCase.label}] fixes: ${testCase.errorDescription.split("\n")[0]}`, async () => {
      // 1. Restore clean snapshot
      await DatabaseSnapshotter.restoreSnapshot("website_generated");
      const ctx = await getTestContext();
      await db.delete(llmUsage);

      const filesBefore = await snapshotFiles(ctx.websiteId);

      // 2. Find and mutate the target file
      const targetPath = findFilePath(filesBefore, testCase.targetFile);
      expect(targetPath, `Target file matching "${testCase.targetFile}" should exist`).toBeDefined();

      const originalContent = filesBefore.get(targetPath!);
      expect(originalContent, `Target file should have content`).toBeDefined();

      const buggedContent = testCase.injectBug(originalContent!);
      expect(buggedContent).not.toBe(originalContent); // Sanity: bug was actually injected

      // Write the bugged content back to the database
      await db
        .update(websiteFiles)
        .set({ content: buggedContent })
        .where(
          and(
            eq(websiteFiles.websiteId, ctx.websiteId),
            eq(websiteFiles.path, targetPath!)
          )
        );

      console.log(`  Injected bug "${testCase.label}" into ${targetPath}`);
      console.log(`  Error: ${testCase.errorDescription.split("\n")[0]}`);

      // 3. Build the bug fix prompt (same as bugFixNode)
      const promptState = {
        websiteId: ctx.websiteId,
        jwt: "test-jwt",
        errors: testCase.errorDescription,
        isFirstMessage: false,
      };
      const systemPrompt = await buildBugFixPrompt(promptState);

      // 4. Run the coding agent (full route, same as bugFixNode)
      //    Wrap in usageStorage so LLM callbacks collect usage records
      const usageContext = createUsageContext({ threadId: ctx.threadId });
      await usageStorage.run(usageContext, () =>
        createCodingAgent(
          { websiteId: ctx.websiteId, jwt: "test-jwt", isFirstMessage: false },
          {
            messages: [
              new HumanMessage(
                `Please analyze the errors and resolve them so my site runs successfully.`
              ),
            ],
            systemPrompt,
            route: "full",
            recursionLimit: 100,
          }
        )
      );

      // Persist usage records collected during the agent run
      const chatId = (await db
        .select({ id: chats.id })
        .from(chats)
        .where(eq(chats.threadId, ctx.threadId))
        .limit(1))[0]?.id;

      if (usageContext.records.length > 0 && chatId) {
        let modelConfigs: Record<string, import("@core").ModelConfig> | undefined;
        try { modelConfigs = await LLMManager.getModelConfigs(); } catch {}
        await persistUsage(
          usageContext.records,
          { chatId, threadId: ctx.threadId, graphName: "bug-fix-eval" },
          modelConfigs
        );
      }

      // 5. Read files after fix
      const filesAfter = await snapshotFiles(ctx.websiteId);

      // 6. Assert the bug is fixed
      if (testCase.expectedContains?.length) {
        for (const { file, text } of testCase.expectedContains) {
          const content = findFile(filesAfter, file);
          expect(content, `File matching "${file}" should exist after fix`).toBeDefined();
          expect(content, `File matching "${file}" should contain "${text}"`).toContain(text);
        }
      }

      if (testCase.expectedAbsent?.length) {
        for (const { file, text } of testCase.expectedAbsent) {
          const content = findFile(filesAfter, file);
          if (content) {
            expect(
              content,
              `File matching "${file}" should NOT contain "${text}"`
            ).not.toContain(text);
          }
        }
      }

      // Special check for duplicate-component-render: only one <Hero in IndexPage
      if (testCase.label === "duplicate-component-render") {
        const indexContent = findFile(filesAfter, "IndexPage");
        expect(indexContent).toBeDefined();
        const heroCount = (indexContent!.match(/<Hero/g) || []).length;
        expect(
          heroCount,
          `IndexPage should have exactly 1 <Hero render, found ${heroCount}`
        ).toBe(1);
      }

      // 7. Tracking invariant
      const trackingViolations = checkTrackingPreserved(filesBefore, filesAfter);
      if (trackingViolations.length > 0) {
        console.error(`  Tracking violations: ${trackingViolations.join(", ")}`);
      }
      expect(trackingViolations, "L10 tracking must be preserved").toHaveLength(0);

      // 8. Cost summary
      const usageRecords = await db.select().from(llmUsage);
      const cost = usageRecords.reduce((sum, r) => sum + (r.costMillicredits ?? 0), 0);
      cumulativeCostMillicredits += cost;

      logCostSummary(`[${testCase.label}]`, usageRecords);
      console.log(`  Cumulative: $${(cumulativeCostMillicredits / 100_000).toFixed(4)}`);
    }, 120000);
  }
});
