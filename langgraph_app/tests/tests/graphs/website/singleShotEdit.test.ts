/**
 * Single-Shot Edit Eval Suite
 *
 * Tests classifier routing and single-shot execution across dozens of
 * realistic user edit requests. All tests hit real APIs (no Polly recordings).
 *
 * Component inventory (from website_generated snapshot):
 *   Hero.tsx, Features.tsx, CTA.tsx, Footer.tsx, HowItWorks.tsx,
 *   Problem.tsx, SocialProof.tsx, App.tsx (composition root)
 *
 * Cost budget: ~$7 total
 * - Classifier calls: ~$0.0001 each (negligible)
 * - Single-shot edits (Haiku): ~$0.005 each (all 25 simple edits executed)
 *
 * Usage:
 *   cd langgraph_app
 *   LAUNCH10_ENV=test pnpm vitest run tests/tests/graphs/website/singleShotEdit.test.ts --no-file-parallelism
 *
 *   # Move .only to the describe you want to run:
 *   #   "Classifier routing" → cheapest, run first
 *   #   "Single-shot execution" → real edits through full pipeline
 */
import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { db, websites, chats, websiteFiles, llmUsage, eq, and } from "@db";
import { consumeStream, logCostSummary } from "@support";
import { DatabaseSnapshotter } from "@services";
import { WebsiteAPI } from "@api";
import { getCodingAgentBackend, classifyEditWithLLM } from "@nodes";
import { buildFileTree } from "@nodes";
import type { ThreadIDType } from "@types";
import type { WebsiteGraphState } from "@annotation";

// ─────────────────────────────────────────────────────────────────────────────
// Test case definitions
// ─────────────────────────────────────────────────────────────────────────────

interface EditTestCase {
  prompt: string;
  label: string;
  expectedRoute: "simple" | "complex";
  /**
   * File path substrings we expect to be modified.
   * Matches against the actual components: Hero.tsx, Features.tsx, CTA.tsx,
   * Footer.tsx, HowItWorks.tsx, Problem.tsx, SocialProof.tsx, App.tsx
   */
  expectedTargets?: string[];
}

// ── SIMPLE edits ────────────────────────────────────────────────────────────

const SIMPLE_EDITS: EditTestCase[] = [
  // ── Hero-targeted ──
  {
    prompt: "Change the headline to 'Start Your Journey Today'",
    label: "hero-headline-text",
    expectedRoute: "simple",
    expectedTargets: ["Hero"],
  },
  {
    prompt: "Make the hero section taller with more padding",
    label: "hero-padding",
    expectedRoute: "simple",
    expectedTargets: ["Hero"],
  },
  {
    prompt: "Add a subtle shadow to the hero section",
    label: "hero-shadow",
    expectedRoute: "simple",
    expectedTargets: ["Hero"],
  },
  {
    prompt: "Remove the background image from the hero",
    label: "hero-remove-bg",
    expectedRoute: "simple",
    expectedTargets: ["Hero"],
  },
  {
    prompt: "The hero doesn't pop enough, make it stand out more",
    label: "hero-pop",
    expectedRoute: "simple",
    expectedTargets: ["Hero"],
  },
  {
    prompt: "Make the top part bigger",
    label: "vague-top-bigger",
    expectedRoute: "simple",
    expectedTargets: ["Hero"],
  },
  {
    prompt: "Change the subheading under the hero to something more compelling",
    label: "hero-subheading-rewrite",
    expectedRoute: "simple",
    expectedTargets: ["Hero"],
  },

  // ── Features-targeted ──
  {
    prompt: "Center everything in the features section",
    label: "features-center",
    expectedRoute: "simple",
    expectedTargets: ["Features"],
  },
  {
    prompt: "Reduce the gap between the features cards",
    label: "features-gap",
    expectedRoute: "simple",
    expectedTargets: ["Features"],
  },
  {
    prompt: "Make the background of the features section slightly darker",
    label: "features-bg-darker",
    expectedRoute: "simple",
    expectedTargets: ["Features"],
  },
  {
    prompt: "Make the feature icons bigger",
    label: "features-icon-size",
    expectedRoute: "simple",
    expectedTargets: ["Features"],
  },

  // ── CTA-targeted ──
  {
    prompt: "Update the CTA button text to say 'Join the Waitlist'",
    label: "cta-button-text",
    expectedRoute: "simple",
    expectedTargets: ["CTA"],
  },
  {
    prompt: "Make the CTA button red",
    label: "cta-button-red",
    expectedRoute: "simple",
    expectedTargets: ["CTA"],
  },
  {
    prompt: "Make the call-to-action section more urgent",
    label: "cta-urgency",
    expectedRoute: "simple",
    expectedTargets: ["CTA"],
  },

  // ── Footer-targeted ──
  {
    prompt: "Make the footer copyright say 2026 instead of 2025",
    label: "footer-year",
    expectedRoute: "simple",
    expectedTargets: ["Footer"],
  },
  {
    prompt: "Make the footer background darker",
    label: "footer-bg",
    expectedRoute: "simple",
    expectedTargets: ["Footer"],
  },

  // ── HowItWorks-targeted ──
  {
    prompt: "Make the steps in the how it works section bigger",
    label: "howitworks-step-size",
    expectedRoute: "simple",
    expectedTargets: ["HowItWorks"],
  },
  {
    prompt: "Add numbers to each step in the how it works section",
    label: "howitworks-add-numbers",
    expectedRoute: "simple",
    expectedTargets: ["HowItWorks"],
  },

  // ── Problem-targeted ──
  {
    prompt: "Change the problem section heading to 'The Real Cost of Bad Scheduling'",
    label: "problem-heading",
    expectedRoute: "simple",
    expectedTargets: ["Problem"],
  },

  // ── SocialProof-targeted ──
  {
    prompt: "Make the social proof stats bigger and bolder",
    label: "socialproof-bigger",
    expectedRoute: "simple",
    expectedTargets: ["SocialProof"],
  },
  {
    prompt: "Change the social proof section to use a darker background",
    label: "socialproof-bg",
    expectedRoute: "simple",
    expectedTargets: ["SocialProof"],
  },

  // ── Cross-cutting: should touch IndexPage.tsx (composition root) or App.tsx ──
  {
    prompt: "Add more whitespace between sections",
    label: "cross-section-spacing",
    expectedRoute: "simple",
    expectedTargets: ["IndexPage"],
  },
  {
    prompt: "Swap the order of the features and how it works sections",
    label: "cross-swap-sections",
    expectedRoute: "simple",
    expectedTargets: ["IndexPage"],
  },
  {
    prompt: "Hide the social proof section",
    label: "cross-hide-socialproof",
    expectedRoute: "simple",
    expectedTargets: ["IndexPage"],
  },
  {
    prompt: "Remove the problem section from the page",
    label: "cross-remove-problem",
    expectedRoute: "simple",
    expectedTargets: ["IndexPage"],
  },
];

// ── COMPLEX edits ───────────────────────────────────────────────────────────

const COMPLEX_EDITS: EditTestCase[] = [
  // New sections
  {
    prompt: "Add a testimonials section with 3 customer reviews",
    label: "add-testimonials",
    expectedRoute: "complex",
  },
  {
    prompt: "Add a contact form at the bottom of the page",
    label: "add-contact-form",
    expectedRoute: "complex",
  },
  {
    prompt: "Create a FAQ section with expandable questions",
    label: "add-faq-accordion",
    expectedRoute: "complex",
  },
  {
    prompt: "Add a pricing section with 3 tiers",
    label: "add-pricing",
    expectedRoute: "complex",
  },
  {
    prompt: "Add a navigation bar at the top of the page",
    label: "add-navbar",
    expectedRoute: "complex",
  },

  // Major redesigns
  {
    prompt: "Completely redesign the hero to use a split layout with image on the right",
    label: "redesign-hero-split",
    expectedRoute: "complex",
  },
  {
    prompt: "Rebuild the features section as a bento grid layout",
    label: "redesign-features-bento",
    expectedRoute: "complex",
  },
  {
    prompt: "Make the entire page use a dark theme with neon accents",
    label: "redesign-dark-neon",
    expectedRoute: "complex",
  },

  // Interactive features
  {
    prompt: "Add a countdown timer to the hero section that counts down to launch day",
    label: "add-countdown-timer",
    expectedRoute: "complex",
  },
  {
    prompt: "Add smooth scroll animations when sections come into view",
    label: "add-scroll-animations",
    expectedRoute: "complex",
  },

  // Bug reports
  {
    prompt: "The page is broken on mobile, nothing is aligned properly",
    label: "bug-mobile-broken",
    expectedRoute: "complex",
  },
  {
    prompt: "There's a weird gap at the bottom of the page, something is wrong",
    label: "bug-bottom-gap",
    expectedRoute: "complex",
  },

  // Multi-file structural
  {
    prompt: "Change all the icons to use a different icon library",
    label: "change-icon-library",
    expectedRoute: "complex",
  },
  {
    prompt: "Add a second page for pricing and link to it from the hero CTA",
    label: "add-second-page",
    expectedRoute: "complex",
  },
];

const ALL_CASES = [...SIMPLE_EDITS, ...COMPLEX_EDITS];

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

async function getChangedFiles(websiteId: number, before: Map<string, string>): Promise<string[]> {
  const after = await db.select().from(websiteFiles).where(eq(websiteFiles.websiteId, websiteId));

  const changed: string[] = [];
  for (const file of after) {
    const oldContent = before.get(file.path!);
    if (oldContent === undefined || oldContent !== file.content) {
      changed.push(file.path!);
    }
  }
  return changed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Single-Shot Edit Eval", () => {
  afterAll(() => {
    console.log("\n━━━ TOTAL EVAL COST ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(
      `Total spend: $${(cumulativeCostMillicredits / 100_000).toFixed(4)} ` +
        `(${cumulativeCostMillicredits.toLocaleString()} millicredits)`
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Part 1: Classifier Routing Accuracy (~$0.004 total)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe("Classifier routing", () => {
    let fileTree: string;

    beforeAll(async () => {
      await DatabaseSnapshotter.restoreSnapshot("website_generated");
      const [website] = await db.select().from(websites).limit(1);
      if (!website) throw new Error("No website found");

      const backend = await getCodingAgentBackend({
        websiteId: website.id,
        jwt: "test-jwt",
      } as WebsiteGraphState);
      const { tree } = await buildFileTree(backend);
      fileTree = tree;
      await backend.cleanup();
    }, 30000);

    it("correctly classifies all test cases", async () => {
      const results: {
        label: string;
        prompt: string;
        expected: string;
        actual: string;
        correct: boolean;
      }[] = [];

      for (const testCase of ALL_CASES) {
        const actual = await classifyEditWithLLM(testCase.prompt, fileTree);
        results.push({
          label: testCase.label,
          prompt: testCase.prompt.slice(0, 65),
          expected: testCase.expectedRoute,
          actual,
          correct: actual === testCase.expectedRoute,
        });
      }

      console.log("\n━━━ CLASSIFIER ROUTING RESULTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(
        "Label".padEnd(28) + "Exp".padEnd(9) + "Got".padEnd(9) + "OK?".padEnd(6) + "Prompt"
      );
      console.log("─".repeat(110));
      for (const r of results) {
        console.log(
          r.label.padEnd(28) +
            r.expected.padEnd(9) +
            r.actual.padEnd(9) +
            (r.correct ? " OK " : "FAIL").padEnd(6) +
            r.prompt
        );
      }

      const correct = results.filter((r) => r.correct).length;
      const total = results.length;
      console.log("─".repeat(110));
      console.log(`Accuracy: ${correct}/${total} (${((correct / total) * 100).toFixed(1)}%)`);

      const misclassified = results.filter((r) => !r.correct);
      if (misclassified.length > 0) {
        console.log("\n━━━ MISCLASSIFICATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        for (const m of misclassified) {
          console.log(`  ${m.label}: expected=${m.expected} got=${m.actual}`);
          console.log(`    "${m.prompt}"`);
        }
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      expect(correct / total).toBeGreaterThanOrEqual(0.8);
    }, 120000);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Part 2: Single-Shot Execution (all 25 simple edits)
  //
  // Runs ALL simple edits through the full pipeline. Each test restores
  // from snapshot for isolation.
  //
  // Coverage across ALL real components:
  //   Hero.tsx, Features.tsx, CTA.tsx, Footer.tsx,
  //   HowItWorks.tsx, Problem.tsx, SocialProof.tsx, IndexPage.tsx
  //
  // Verifies per edit:
  //   1. Stream returns non-empty chat response
  //   2. Cost under $0.02
  //   3. ≤3 LLM calls
  //   4. At least one file modified
  //   5. Correct file(s) modified (warns if wrong target)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe("Single-shot execution", () => {
    let ctx: Awaited<ReturnType<typeof getTestContext>>;

    afterEach(async () => {
      if (ctx?.websiteId) {
        try {
          const backend = await getCodingAgentBackend({
            websiteId: ctx.websiteId,
            jwt: "test-jwt",
          } as WebsiteGraphState);
          await backend.cleanup();
        } catch {}
      }
    });

    for (const testCase of SIMPLE_EDITS) {
      it(`[${testCase.label}] ${testCase.prompt}`, async () => {
        await DatabaseSnapshotter.restoreSnapshot("website_generated");
        ctx = await getTestContext();
        await db.delete(llmUsage);

        const filesBefore = await snapshotFiles(ctx.websiteId);

        const response = WebsiteAPI.stream({
          messages: [{ role: "user", content: testCase.prompt }],
          threadId: ctx.threadId,
          state: {
            websiteId: ctx.websiteId,
            threadId: ctx.threadId,
            accountId: ctx.accountId,
            projectId: ctx.projectId,
            jwt: "test-jwt",
            messages: [new HumanMessage(testCase.prompt)],
          },
        });
        const streamOutput = await consumeStream(response);

        // ── Chat response ──
        expect(streamOutput.length).toBeGreaterThan(0);

        // ── Cost ──
        const usageRecords = await db.select().from(llmUsage);
        const cost = usageRecords.reduce((sum, r) => sum + (r.costMillicredits ?? 0), 0);
        cumulativeCostMillicredits += cost;

        logCostSummary(`[${testCase.label}]`, usageRecords);
        console.log(`  Cumulative: $${(cumulativeCostMillicredits / 100_000).toFixed(4)}`);

        expect(usageRecords.length).toBeGreaterThan(0);
        expect(cost / 100_000).toBeLessThan(0.02);
        expect(usageRecords.length).toBeLessThanOrEqual(3);

        // ── File changes ──
        const changed = await getChangedFiles(ctx.websiteId, filesBefore);
        console.log(`  Changed: ${changed.length > 0 ? changed.join(", ") : "(none)"}`);

        expect(changed.length).toBeGreaterThan(0);

        // Soft-assert target files
        if (testCase.expectedTargets?.length) {
          for (const target of testCase.expectedTargets) {
            const hit = changed.some((p) => p.toLowerCase().includes(target.toLowerCase()));
            if (!hit) {
              console.warn(
                `  ⚠ Expected "${target}" to be modified. Changed: ${changed.join(", ")}`
              );
            }
          }
        }
      }, 120000);
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Part 3: Complex edits classifier check (cheap, no execution)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe("Complex routing verification", () => {
    let fileTree: string;

    beforeAll(async () => {
      await DatabaseSnapshotter.restoreSnapshot("website_generated");
      const [website] = await db.select().from(websites).limit(1);
      if (!website) throw new Error("No website found");

      const backend = await getCodingAgentBackend({
        websiteId: website.id,
        jwt: "test-jwt",
      } as WebsiteGraphState);
      const { tree } = await buildFileTree(backend);
      fileTree = tree;
      await backend.cleanup();
    }, 30000);

    for (const testCase of COMPLEX_EDITS) {
      it(`routes "${testCase.label}" to complex`, async () => {
        const route = await classifyEditWithLLM(testCase.prompt, fileTree);
        console.log(`[${testCase.label}] classified as: ${route} (expected: complex)`);
        expect(route).toBe("complex");
      }, 15000);
    }
  });
});
