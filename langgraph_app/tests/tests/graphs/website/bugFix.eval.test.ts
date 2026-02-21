/**
 * Bug Fix Eval Suite
 *
 * Tests whether the coding agent can actually fix real, injected bugs.
 * Each test starts from the known-good `website_generated` snapshot,
 * injects a specific bug, then runs the coding agent through the full
 * WebsiteAPI.stream() pipeline (same middleware, usage tracking, etc).
 *
 * Each assertion is checked TWICE:
 *   1. Pre-fix (inverted) — proves the bug was actually injected
 *   2. Post-fix (normal)  — proves the agent fixed it
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
import { consumeStream, logCostSummary } from "@support";
import { DatabaseSnapshotter } from "@services";
import { WebsiteAPI } from "@api";
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
  /**
   * Assertions that define "fixed". Checked twice:
   *   - Pre-fix (inverted): expectedContains → must be ABSENT, expectedAbsent → must be PRESENT
   *   - Post-fix (normal):  expectedContains → must be PRESENT, expectedAbsent → must be ABSENT
   */
  expectedContains?: ContentAssertion[];
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
      // Add <Fake /> before the closing </div> of the main wrapper
      return withImport.replace(/(<\/div>\s*\)\s*};?\s*$)/m, `  <Fake />\n$1`);
    },
    errorDescription:
      "Build error:\nModule not found: Cannot find module '../components/Fake' imported from src/pages/IndexPage.tsx",
    expectedAbsent: [
      { file: "IndexPage", text: "../components/Fake" },
      { file: "IndexPage", text: "<Fake />" },
    ],
  },
  {
    label: "wrong-import-path",
    targetFile: "IndexPage",
    injectBug: (content: string) => {
      // Change Hero import path to a typo
      return content.replace(/from\s+["'](.+\/Hero)["']/, `from "../components/Hiro"`);
    },
    errorDescription:
      "Build error:\nModule not found: Cannot find module '../components/Hiro' imported from src/pages/IndexPage.tsx\n\nDid you mean '../components/Hero'?",
    expectedAbsent: [{ file: "IndexPage", text: "../components/Hiro" }],
  },
  {
    label: "undefined-variable",
    targetFile: "Hero",
    injectBug: (content: string) => {
      // Insert {undefinedVar} into the JSX after the first <div
      return content.replace(/(<div[^>]*>)/, `$1\n        {undefinedVar}`);
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
      return content.replace(/className="([^"]+)"/, `className={styles.heroWrapper}`);
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
      return content.replace(/(<Hero\s*\/?>)/, `$1\n        <Hero />`);
    },
    errorDescription:
      'Warning: Each child in a list should have a unique "key" prop.\n\nMultiple <Hero /> components rendered in IndexPage.tsx. This causes a duplicate key warning and visual duplication on the page.',
    // Post-fix: <Hero still exists (one instance). Pre-fix inversion isn't useful here
    // since <Hero exists in both states. The count check below handles this case.
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

function findFile(files: Map<string, string>, substring: string): string | undefined {
  for (const [path, content] of files) {
    if (path.toLowerCase().includes(substring.toLowerCase())) {
      return content;
    }
  }
  return undefined;
}

function findFilePath(files: Map<string, string>, substring: string): string | undefined {
  for (const [path] of files) {
    if (path.toLowerCase().includes(substring.toLowerCase())) {
      return path;
    }
  }
  return undefined;
}

/**
 * Run content assertions against a file map.
 *
 * mode = "post-fix": expectedContains must be present, expectedAbsent must be absent.
 * mode = "pre-fix":  inverted — expectedAbsent must be PRESENT (proves the bug landed).
 *
 * Both modes read from the same assertion definitions, keeping them wired together.
 */
function checkContentAssertions(
  files: Map<string, string>,
  testCase: BugFixTestCase,
  mode: "pre-fix" | "post-fix"
) {
  const prefix = mode === "pre-fix" ? "PRE-FIX" : "POST-FIX";

  if (mode === "pre-fix") {
    // expectedAbsent items should be PRESENT in the bugged files (that's the bug we injected)
    for (const { file, text } of testCase.expectedAbsent ?? []) {
      const content = findFile(files, file);
      expect(content, `${prefix}: "${file}" should contain "${text}" (the injected bug)`).toContain(
        text
      );
    }
  } else {
    // Normal post-fix checks
    for (const { file, text } of testCase.expectedContains ?? []) {
      const content = findFile(files, file);
      expect(content, `${prefix}: file matching "${file}" should exist`).toBeDefined();
      expect(content, `${prefix}: "${file}" should contain "${text}"`).toContain(text);
    }
    for (const { file, text } of testCase.expectedAbsent ?? []) {
      const content = findFile(files, file);
      if (content) {
        expect(content, `${prefix}: "${file}" should NOT contain "${text}"`).not.toContain(text);
      }
    }
  }
}

/**
 * Check that LeadForm tracking was not removed from any file that had it.
 */
function checkTrackingPreserved(before: Map<string, string>, after: Map<string, string>): string[] {
  const violations: string[] = [];
  for (const [path, content] of before) {
    if (content.includes("LeadForm")) {
      const afterContent = after.get(path);
      if (afterContent && !afterContent.includes("LeadForm")) {
        violations.push(`LeadForm removed from ${path}`);
      }
    }
  }
  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(!!process.env.CI)("Bug Fix Eval", () => {
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
      expect(
        targetPath,
        `Target file matching "${testCase.targetFile}" should exist`
      ).toBeDefined();

      const originalContent = filesBefore.get(targetPath!);
      expect(originalContent, `Target file should have content`).toBeDefined();

      const buggedContent = testCase.injectBug(originalContent!);
      expect(buggedContent).not.toBe(originalContent); // Sanity: mutation changed something

      // Write the bugged content to DB
      await db
        .update(websiteFiles)
        .set({ content: buggedContent })
        .where(and(eq(websiteFiles.websiteId, ctx.websiteId), eq(websiteFiles.path, targetPath!)));

      // 3. Pre-fix assertions — same assertions, inverted: proves the bug landed
      const buggedFiles = await snapshotFiles(ctx.websiteId);
      checkContentAssertions(buggedFiles, testCase, "pre-fix");

      // Special pre-fix: duplicate-component-render should have 2+ <Hero renders
      if (testCase.label === "duplicate-component-render") {
        const heroCount = (buggedContent.match(/<Hero/g) || []).length;
        expect(
          heroCount,
          `PRE-FIX: should have 2+ <Hero, found ${heroCount}`
        ).toBeGreaterThanOrEqual(2);
      }

      console.log(`  Injected bug "${testCase.label}" into ${targetPath}`);
      console.log(`  Error: ${testCase.errorDescription.split("\n")[0]}`);

      // 4. Run through WebsiteAPI.stream() — same pipeline as production
      const userMessage = `My site has the following error. Please fix it:\n\n${testCase.errorDescription}`;
      const response = WebsiteAPI.stream({
        messages: [{ role: "user", content: userMessage }],
        threadId: ctx.threadId,
        state: {
          websiteId: ctx.websiteId,
          threadId: ctx.threadId,
          accountId: ctx.accountId,
          projectId: ctx.projectId,
          jwt: "test-jwt",
          messages: [new HumanMessage(userMessage)],
        },
      });
      const streamOutput = await consumeStream(response);
      expect(streamOutput.length).toBeGreaterThan(0);

      // 5. Post-fix assertions — same assertions, normal direction
      const filesAfter = await snapshotFiles(ctx.websiteId);
      checkContentAssertions(filesAfter, testCase, "post-fix");

      // Special post-fix: duplicate-component-render should have exactly 1 <Hero
      if (testCase.label === "duplicate-component-render") {
        const indexContent = findFile(filesAfter, "IndexPage");
        expect(indexContent).toBeDefined();
        const heroCount = (indexContent!.match(/<Hero/g) || []).length;
        expect(heroCount, `POST-FIX: should have exactly 1 <Hero, found ${heroCount}`).toBe(1);
      }

      // 6. Tracking invariant
      const trackingViolations = checkTrackingPreserved(filesBefore, filesAfter);
      if (trackingViolations.length > 0) {
        console.error(`  Tracking violations: ${trackingViolations.join(", ")}`);
      }
      expect(trackingViolations, "LeadForm tracking must be preserved").toHaveLength(0);

      // 7. Cost summary
      const usageRecords = await db.select().from(llmUsage);
      const cost = usageRecords.reduce((sum, r) => sum + (r.costMillicredits ?? 0), 0);
      cumulativeCostMillicredits += cost;

      logCostSummary(`[${testCase.label}]`, usageRecords);
      console.log(`  Cumulative: $${(cumulativeCostMillicredits / 100_000).toFixed(4)}`);
    }, 120000);
  }
});
