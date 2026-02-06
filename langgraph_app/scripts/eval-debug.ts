#!/usr/bin/env tsx
/**
 * Visual Debug Mode for Evals
 *
 * Runs a single eval case with visual before/after comparison using Playwright.
 * Useful for debugging low-scoring eval cases.
 *
 * Usage:
 *   pnpm eval:debug                     # Interactive mode - pick a test case
 *   pnpm eval:debug edit-visual-hierarchy  # Run specific test case
 *   pnpm eval:debug --list              # List all test cases
 */

// Ensure CACHE_MODE is off before any module loads env.ts
process.env.CACHE_MODE = "false";

import readline from "readline/promises";
import { chromium, type Browser, type Page } from "playwright";
import { HumanMessage } from "@langchain/core/messages";
import { db, websites, chats, websiteFiles, llmUsage, eq, and } from "@db";
import { consumeStream } from "@tests/support/helpers/stream";
import { logCostSummary } from "@tests/support/helpers/costSummary";
import { DatabaseSnapshotter, startWebsiteEditor, type WebsiteEditorOptions } from "@services";
import { WebsiteAPI } from "@api";
import type { ThreadIDType } from "@types";
import { disablePolly } from "@utils";
import { join } from "path";
import { mkdirSync, writeFileSync } from "fs";
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

// ─────────────────────────────────────────────────────────────────────────────
// Test case definitions (same as website.eval.ts)
// ─────────────────────────────────────────────────────────────────────────────

const TEST_CASES: WebsiteEvalInput[] = [
  // ── CREATE FLOW ──
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

  // ── EDIT FLOW ──
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
    userMessage:
      "Improve the overall visual hierarchy — make the page flow better from top to bottom",
    label: "edit-visual-hierarchy",
  },
];

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

function extractSourceCode(files: Record<string, any>): string {
  return Object.entries(files)
    .filter(([path]) => /\.(tsx?|css)$/.test(path) && path.includes("src/"))
    .map(([path, f]) => {
      const content = typeof f === "string" ? f : f?.content ?? "";
      return `### ${path}\n\`\`\`tsx\n${content}\n\`\`\``;
    })
    .join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual capture using website editor
// ─────────────────────────────────────────────────────────────────────────────

interface VisualResult {
  screenshotPath: string;
  files: Record<string, { content: string }>;
  allSourceCode: string;
}

async function captureVisual(
  label: string,
  phase: "before" | "after",
  browser: Browser
): Promise<VisualResult> {
  const ctx = await getTestContext();
  const files = await collectFiles(ctx.websiteId);
  const allSourceCode = extractSourceCode(files);

  // Create output directory
  const outputDir = join(process.cwd(), "eval-debug-output", label);
  mkdirSync(outputDir, { recursive: true });

  // Write files to temp directory for dev server
  const tempDir = join(process.cwd(), ".eval-debug-temp");
  mkdirSync(tempDir, { recursive: true });

  // Write all files
  for (const [filePath, file] of Object.entries(files)) {
    const fullPath = join(tempDir, filePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, file.content);
  }

  // Start dev server and capture screenshot
  const { WebsiteRunner } = await import("@services/editor/core/websiteRunner");
  const port = 5199 + Math.floor(Math.random() * 100);
  const runner = new WebsiteRunner(tempDir, port);

  try {
    await runner.install();
    await runner.start();

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(runner.getUrl(), { waitUntil: "networkidle" });

    // Wait a bit for any animations
    await page.waitForTimeout(1000);

    // Take full page screenshot
    const screenshotPath = join(outputDir, `${phase}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Also take viewport screenshot
    const viewportPath = join(outputDir, `${phase}-viewport.png`);
    await page.screenshot({ path: viewportPath });

    await page.close();

    console.log(`📸 Captured ${phase} screenshot: ${screenshotPath}`);

    return { screenshotPath, files, allSourceCode };
  } finally {
    await runner.stop();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Run eval with visual debugging
// ─────────────────────────────────────────────────────────────────────────────

async function runVisualDebug(testCase: WebsiteEvalInput) {
  console.log("\n" + "=".repeat(70));
  console.log(`🔍 Visual Debug: ${testCase.type} [${testCase.label}]`);
  console.log("=".repeat(70));
  console.log(`\n📝 User message: "${testCase.userMessage}"\n`);

  const browser = await chromium.launch({ headless: true });

  try {
    // Restore appropriate snapshot
    const snapshot = testCase.type === "create" ? "website_step" : "website_generated";
    console.log(`📦 Restoring snapshot: ${snapshot}`);
    await DatabaseSnapshotter.restoreSnapshot(snapshot);

    // Capture BEFORE state (only for edits - creates start from empty)
    let beforeResult: VisualResult | null = null;
    if (testCase.type === "edit") {
      console.log("\n📷 Capturing BEFORE state...");
      beforeResult = await captureVisual(testCase.label, "before", browser);
    }

    // Run the edit/create
    console.log("\n🚀 Running agent...");
    const ctx = await getTestContext();
    await db.delete(llmUsage);

    const response = WebsiteAPI.stream({
      messages: [{ role: "user", content: testCase.userMessage }],
      threadId: ctx.threadId,
      state: {
        websiteId: ctx.websiteId,
        threadId: ctx.threadId,
        accountId: ctx.accountId,
        projectId: ctx.projectId,
        jwt: "test-jwt",
        messages: [new HumanMessage(testCase.userMessage)],
      },
    });
    const streamOutput = await consumeStream(response);

    // Log cost
    const usageRecords = await db.select().from(llmUsage);
    logCostSummary(`${testCase.type} [${testCase.label}]`, usageRecords);

    // Capture AFTER state
    console.log("\n📷 Capturing AFTER state...");
    const afterResult = await captureVisual(testCase.label, "after", browser);

    // Run scorers
    console.log("\n📊 Running scorers...");

    const designScore = await DesignQualityScorer({
      input: testCase.userMessage,
      output: afterResult.allSourceCode,
      useCoT: true,
    });

    const completenessScore = LandingPageCompletenessScorer(afterResult.files);

    const persuasivenessScore = await PersuasivenessScorer({
      input: testCase.userMessage,
      output: afterResult.allSourceCode,
      useCoT: true,
    });

    const avgScore = (designScore + completenessScore + persuasivenessScore) / 3;

    // Print results
    console.log("\n" + "─".repeat(70));
    console.log("📈 SCORES");
    console.log("─".repeat(70));
    console.log(`  Design Quality:     ${(designScore * 100).toFixed(0)}%`);
    console.log(`  Completeness:       ${(completenessScore * 100).toFixed(0)}%`);
    console.log(`  Persuasiveness:     ${(persuasivenessScore * 100).toFixed(0)}%`);
    console.log(`  ─────────────────────`);
    console.log(`  AVERAGE:            ${(avgScore * 100).toFixed(0)}%`);
    console.log("─".repeat(70));

    // Print file locations
    const outputDir = join(process.cwd(), "eval-debug-output", testCase.label);
    console.log("\n📁 Output files:");
    if (beforeResult) {
      console.log(`  Before: ${beforeResult.screenshotPath}`);
    }
    console.log(`  After:  ${afterResult.screenshotPath}`);

    // Save source code for review
    const sourcePath = join(outputDir, "source.md");
    writeFileSync(sourcePath, afterResult.allSourceCode);
    console.log(`  Source: ${sourcePath}`);

    // AI Response
    console.log("\n💬 AI Response:");
    console.log(streamOutput.substring(0, 500) + (streamOutput.length > 500 ? "..." : ""));

    return { designScore, completenessScore, persuasivenessScore, avgScore };
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Handle --list flag
  if (args.includes("--list")) {
    console.log("\n📋 Available test cases:\n");
    TEST_CASES.forEach((tc, i) => {
      console.log(`  ${i + 1}. [${tc.type}] ${tc.label}`);
      console.log(`     "${tc.userMessage.substring(0, 60)}${tc.userMessage.length > 60 ? "..." : ""}"\n`);
    });
    process.exit(0);
  }

  // Handle specific test case argument
  let selectedCase: WebsiteEvalInput | undefined;

  if (args.length > 0 && !args[0].startsWith("--")) {
    const label = args[0];
    selectedCase = TEST_CASES.find((tc) => tc.label === label);
    if (!selectedCase) {
      console.error(`❌ Unknown test case: ${label}`);
      console.log("Run with --list to see available test cases");
      process.exit(1);
    }
  } else {
    // Interactive mode
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n📋 Available test cases:\n");
    TEST_CASES.forEach((tc, i) => {
      console.log(`  ${i + 1}. [${tc.type}] ${tc.label}`);
    });

    const answer = await rl.question("\nSelect a test case (number or label): ");
    rl.close();

    const index = parseInt(answer) - 1;
    if (!isNaN(index) && index >= 0 && index < TEST_CASES.length) {
      selectedCase = TEST_CASES[index];
    } else {
      selectedCase = TEST_CASES.find((tc) => tc.label === answer);
    }

    if (!selectedCase) {
      console.error("❌ Invalid selection");
      process.exit(1);
    }
  }

  console.log(`\n✅ Selected: ${selectedCase.label}`);

  await runVisualDebug(selectedCase);

  console.log("\n✨ Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
