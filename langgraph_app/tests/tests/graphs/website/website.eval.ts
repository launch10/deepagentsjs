/**
 * Website Agent Eval Suite
 *
 * Scores the quality of generated landing pages across representative
 * business types and stylistic directions. Covers both the CREATE flow
 * (full agent) and EDIT flow (single-shot).
 *
 * Scorers:
 * - Design Quality (LLM-as-judge): Visual distinctiveness, hierarchy, interactivity
 * - Landing Page Completeness (programmatic): Structural requirements, tracking, responsiveness
 * - Copy Persuasiveness (LLM-as-judge): Value prop, urgency, CTA effectiveness
 *
 * Cost budget: ~$5-8 total (5 creates × ~$0.80 + 3 edits × ~$0.10 + scorer calls)
 *
 * Uses WebsiteAPI.stream() (same pipeline as production) for proper cost accounting
 * via usageTrackingMiddleware.
 *
 * ARCHITECTURE NOTE: evalite forces `it.concurrent` with a per-task timeout. Our tasks
 * need sequential DB snapshot restores and take 2-5 min each. To avoid timeout issues,
 * we pre-compute ALL results in `data()` (which runs sequentially before tasks launch),
 * then `task()` just looks up the pre-computed result — instant, no timeout risk.
 *
 * Usage:
 *   cd langgraph_app
 *   pnpm eval
 */

// Ensure CACHE_MODE is off before any module loads env.ts.
// env.ts reads process.env at import time, so this must come first.
process.env.CACHE_MODE = "false";

import { evalite } from "evalite";
import { HumanMessage } from "@langchain/core/messages";
import { db, websites, chats, websiteFiles, llmUsage, eq, and } from "@db";
import { consumeStream, logCostSummary } from "@support";
import { DatabaseSnapshotter } from "@services";
import { WebsiteAPI } from "@api";
import type { ThreadIDType } from "@types";
import { disablePolly } from "@utils";
import {
  DesignQualityScorer,
  PersuasivenessScorer,
  LandingPageCompletenessScorer,
} from "@tests/support/evals";

disablePolly();

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type WebsiteEvalInput =
  | { type: "create"; userMessage: string; label: string }
  | { type: "edit"; userMessage: string; label: string };

interface WebsiteEvalOutput {
  type: "create" | "edit";
  label: string;
  userMessage: string;
  /** All source file contents concatenated for scorer */
  allSourceCode: string;
  /** Structured file map for completeness scorer */
  files: Record<string, { content: string }>;
  /** Last AI message text */
  aiResponse: string;
  /** Total cost in dollars */
  costDollars: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function extractSourceCode(files: Record<string, any>): string {
  return Object.entries(files)
    .filter(([path]) => /\.(tsx?|css)$/.test(path) && path.includes("src/"))
    .map(([path, f]) => {
      const content = typeof f === "string" ? f : f?.content ?? "";
      return `### ${path}\n\`\`\`tsx\n${content}\n\`\`\``;
    })
    .join("\n\n");
}

async function collectFiles(websiteId: number): Promise<Record<string, { content: string }>> {
  const dbFiles = await db
    .select()
    .from(websiteFiles)
    .where(eq(websiteFiles.websiteId, websiteId));
  const fileMap: Record<string, { content: string }> = {};
  for (const f of dbFiles) {
    if (f.path) fileMap[f.path] = { content: f.content };
  }
  return fileMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task runners — use WebsiteAPI.stream() for proper cost accounting via
// usageTrackingMiddleware (same pipeline as production)
// ─────────────────────────────────────────────────────────────────────────────

async function runCreate(input: { userMessage: string; label: string }): Promise<WebsiteEvalOutput> {
  await DatabaseSnapshotter.restoreSnapshot("website_step");
  const ctx = await getTestContext();

  await db.delete(llmUsage);

  const response = WebsiteAPI.stream({
    messages: [{ role: "user", content: input.userMessage }],
    threadId: ctx.threadId,
    state: {
      websiteId: ctx.websiteId,
      threadId: ctx.threadId,
      accountId: ctx.accountId,
      projectId: ctx.projectId,
      jwt: "test-jwt",
      messages: [new HumanMessage(input.userMessage)],
    },
  });
  const streamOutput = await consumeStream(response);

  const usageRecords = await db.select().from(llmUsage);
  const costMillicredits = usageRecords.reduce((sum, r) => sum + (r.costMillicredits ?? 0), 0);
  logCostSummary(`Create [${input.label}]`, usageRecords);

  const fileMap = await collectFiles(ctx.websiteId);

  return {
    type: "create",
    label: input.label,
    userMessage: input.userMessage,
    allSourceCode: extractSourceCode(fileMap),
    files: fileMap,
    aiResponse: streamOutput,
    costDollars: costMillicredits / 100_000,
  };
}

async function runEdit(input: { userMessage: string; label: string }): Promise<WebsiteEvalOutput> {
  await DatabaseSnapshotter.restoreSnapshot("website_generated");
  const ctx = await getTestContext();

  await db.delete(llmUsage);

  const response = WebsiteAPI.stream({
    messages: [{ role: "user", content: input.userMessage }],
    threadId: ctx.threadId,
    state: {
      websiteId: ctx.websiteId,
      threadId: ctx.threadId,
      accountId: ctx.accountId,
      projectId: ctx.projectId,
      jwt: "test-jwt",
      messages: [new HumanMessage(input.userMessage)],
    },
  });
  const streamOutput = await consumeStream(response);

  const usageRecords = await db.select().from(llmUsage);
  const costMillicredits = usageRecords.reduce((sum, r) => sum + (r.costMillicredits ?? 0), 0);
  logCostSummary(`Edit [${input.label}]`, usageRecords);

  const fileMap = await collectFiles(ctx.websiteId);

  return {
    type: "edit",
    label: input.label,
    userMessage: input.userMessage,
    allSourceCode: extractSourceCode(fileMap),
    files: fileMap,
    aiResponse: streamOutput,
    costDollars: costMillicredits / 100_000,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-computed results map — populated in data(), looked up in task()
// ─────────────────────────────────────────────────────────────────────────────

const preComputedResults = new Map<string, WebsiteEvalOutput>();

// ─────────────────────────────────────────────────────────────────────────────
// Test case definitions
// ─────────────────────────────────────────────────────────────────────────────

const TEST_CASES: WebsiteEvalInput[] = [
  // ── CREATE FLOW ──
  // These test whether the agent produces quality pages across different
  // stylistic directions, all using the same brainstorm context.
  {
    type: "create",
    userMessage: "Create a landing page for this business",
    label: "default-create",
  },
  {
    type: "create",
    userMessage:
      "Create a bold, dark-themed landing page with dramatic visuals and a strong call to action",
    label: "dark-dramatic",
  },
  {
    type: "create",
    userMessage:
      "Create a clean, minimalist landing page — let the whitespace breathe and keep it elegant",
    label: "minimalist-clean",
  },
  {
    type: "create",
    userMessage:
      "Create a landing page that emphasizes social proof and trust — put testimonials and credibility front and center",
    label: "social-proof-focused",
  },
  {
    type: "create",
    userMessage:
      "Create a high-energy, conversion-focused landing page with urgency and a clear value proposition above the fold",
    label: "conversion-focused",
  },

  // ── EDIT FLOW (single-shot path) ──
  // These test whether design-sensitive edits through single-shot produce quality results.
  {
    type: "edit",
    userMessage: "Make the hero section more dramatic and eye-catching",
    label: "edit-hero-dramatic",
  },
  {
    type: "edit",
    userMessage: "The features section looks generic, make it more visually interesting",
    label: "edit-features-visual",
  },
  {
    type: "edit",
    userMessage: "Improve the overall visual hierarchy — make the page flow better from top to bottom",
    label: "edit-visual-hierarchy",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Eval definition
// ─────────────────────────────────────────────────────────────────────────────

evalite("Website Agent", {
  data: async () => {
    // Pre-compute ALL results sequentially here.
    // evalite forces it.concurrent on tasks with a per-task timeout, but data()
    // runs to completion before tasks launch — no timeout or concurrency issues.
    for (const input of TEST_CASES) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`Running: ${input.type} [${input.label}]`);
      console.log(`${"=".repeat(60)}`);

      const result =
        input.type === "create"
          ? await runCreate(input)
          : await runEdit(input);

      preComputedResults.set(input.label, result);

      console.log(`Completed: ${input.label} — cost: $${result.costDollars.toFixed(4)}`);
      console.log(`Files: ${Object.keys(result.files).length}, Source length: ${result.allSourceCode.length}`);
    }

    return TEST_CASES.map((input) => ({ input }));
  },

  task: async (input: WebsiteEvalInput): Promise<WebsiteEvalOutput> => {
    // All heavy work was done in data(). Just look up the pre-computed result.
    const result = preComputedResults.get(input.label);
    if (!result) {
      throw new Error(`No pre-computed result for "${input.label}" — data() may have failed`);
    }
    return result;
  },

  scorers: [
    {
      name: "Design Quality",
      description: "LLM-as-judge assessment of visual distinctiveness, hierarchy, and polish",
      scorer: async ({ output, input }: { output: WebsiteEvalOutput; input: WebsiteEvalInput }) => {
        if (!output.allSourceCode) return 0;
        return await DesignQualityScorer({
          input: input.userMessage ?? input.label,
          output: output.allSourceCode,
          useCoT: true,
        });
      },
    },
    {
      name: "Completeness",
      description: "Programmatic check for structural requirements (sections, tracking, responsive)",
      scorer: async ({ output }: { output: WebsiteEvalOutput }) => {
        return LandingPageCompletenessScorer(output.files);
      },
    },
    {
      name: "Copy Persuasiveness",
      description: "LLM-as-judge assessment of landing page copy quality",
      scorer: async ({ output, input }: { output: WebsiteEvalOutput; input: WebsiteEvalInput }) => {
        if (!output.allSourceCode) return 0;
        return await PersuasivenessScorer({
          input: input.userMessage ?? input.label,
          output: output.allSourceCode,
          useCoT: true,
        });
      },
    },
  ],
});
