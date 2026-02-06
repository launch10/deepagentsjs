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
 * Cost budget: ~$5-8 total (5 creates × ~$0.80 + 3 edits × ~$0.01 + scorer calls)
 *
 * Usage:
 *   cd langgraph_app
 *   pnpm eval
 */
import { evalite } from "evalite";
import { HumanMessage } from "@langchain/core/messages";
import { db, websites, chats, websiteFiles, llmUsage, eq, and } from "@db";
import { consumeStream, logCostSummary } from "@support";
import { DatabaseSnapshotter } from "@services";
import { WebsiteAPI } from "@api";
import { getCodingAgentBackend } from "@nodes";
import { websiteGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import { Website, isAIMessage, type ThreadIDType } from "@types";
import { disablePolly } from "@utils";
import type { WebsiteGraphState } from "@annotation";
import {
  DesignQualityScorer,
  PersuasivenessScorer,
  LandingPageCompletenessScorer,
} from "@tests/support/evals";

disablePolly();

const websiteGraph = uncompiledGraph.compile({ ...graphParams, name: "website" });

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

function extractAIResponse(state: WebsiteGraphState): string {
  const aiMessages = state.messages.filter(isAIMessage);
  const last = aiMessages.at(-1);
  if (!last) return "";
  if (typeof last.content === "string") return last.content;
  if (Array.isArray(last.content)) {
    return last.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Task runners
// ─────────────────────────────────────────────────────────────────────────────

async function runCreate(input: { userMessage: string; label: string }): Promise<WebsiteEvalOutput> {
  // Each create needs a fresh snapshot
  await DatabaseSnapshotter.restoreSnapshot("website_step");
  const ctx = await getTestContext();

  // Clear any prior LLM usage records for clean cost tracking
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
  await consumeStream(response);

  // Read final state from checkpoint
  const checkpoint = await websiteGraph.getState({ configurable: { thread_id: ctx.threadId } });
  const state = checkpoint.values as WebsiteGraphState;

  // Cost tracking
  const usageRecords = await db.select().from(llmUsage);
  const costMillicredits = usageRecords.reduce((sum, r) => sum + (r.costMillicredits ?? 0), 0);
  logCostSummary(`Create [${input.label}]`, usageRecords);

  // Build structured files from DB (state.files may have binary/non-source entries)
  const dbFiles = await db
    .select()
    .from(websiteFiles)
    .where(eq(websiteFiles.websiteId, ctx.websiteId));
  const fileMap: Record<string, { content: string }> = {};
  for (const f of dbFiles) {
    if (f.path) fileMap[f.path] = { content: f.content };
  }

  // Cleanup backend
  try {
    const backend = await getCodingAgentBackend({ websiteId: ctx.websiteId, jwt: "test-jwt" });
    await backend.cleanup();
  } catch {
    // Non-critical
  }

  return {
    type: "create",
    label: input.label,
    userMessage: input.userMessage,
    allSourceCode: extractSourceCode(fileMap),
    files: fileMap,
    aiResponse: extractAIResponse(state),
    costDollars: costMillicredits / 100_000,
  };
}

async function runEdit(input: { userMessage: string; label: string }): Promise<WebsiteEvalOutput> {
  // Each edit needs a fresh generated website
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
  await consumeStream(response);

  const checkpoint = await websiteGraph.getState({ configurable: { thread_id: ctx.threadId } });
  const state = checkpoint.values as WebsiteGraphState;

  const usageRecords = await db.select().from(llmUsage);
  const costMillicredits = usageRecords.reduce((sum, r) => sum + (r.costMillicredits ?? 0), 0);
  logCostSummary(`Edit [${input.label}]`, usageRecords);

  const dbFiles = await db
    .select()
    .from(websiteFiles)
    .where(eq(websiteFiles.websiteId, ctx.websiteId));
  const fileMap: Record<string, { content: string }> = {};
  for (const f of dbFiles) {
    if (f.path) fileMap[f.path] = { content: f.content };
  }

  try {
    const backend = await getCodingAgentBackend({ websiteId: ctx.websiteId, jwt: "test-jwt" });
    await backend.cleanup();
  } catch {
    // Non-critical
  }

  return {
    type: "edit",
    label: input.label,
    userMessage: input.userMessage,
    allSourceCode: extractSourceCode(fileMap),
    files: fileMap,
    aiResponse: extractAIResponse(state),
    costDollars: costMillicredits / 100_000,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Eval definition
// ─────────────────────────────────────────────────────────────────────────────

evalite("Website Agent", {
  data: async () => {
    return [
      // ── CREATE FLOW ──
      // These test whether the agent produces quality pages across different
      // stylistic directions, all using the same brainstorm context.
      {
        input: {
          type: "create" as const,
          userMessage: "Create a landing page for this business",
          label: "default-create",
        },
      },
      {
        input: {
          type: "create" as const,
          userMessage:
            "Create a bold, dark-themed landing page with dramatic visuals and a strong call to action",
          label: "dark-dramatic",
        },
      },
      {
        input: {
          type: "create" as const,
          userMessage:
            "Create a clean, minimalist landing page — let the whitespace breathe and keep it elegant",
          label: "minimalist-clean",
        },
      },
      {
        input: {
          type: "create" as const,
          userMessage:
            "Create a landing page that emphasizes social proof and trust — put testimonials and credibility front and center",
          label: "social-proof-focused",
        },
      },
      {
        input: {
          type: "create" as const,
          userMessage:
            "Create a high-energy, conversion-focused landing page with urgency and a clear value proposition above the fold",
          label: "conversion-focused",
        },
      },

      // ── EDIT FLOW (single-shot path) ──
      // These test whether design-sensitive edits through single-shot produce quality results.
      {
        input: {
          type: "edit" as const,
          userMessage: "Make the hero section more dramatic and eye-catching",
          label: "edit-hero-dramatic",
        },
      },
      {
        input: {
          type: "edit" as const,
          userMessage: "The features section looks generic, make it more visually interesting",
          label: "edit-features-visual",
        },
      },
      {
        input: {
          type: "edit" as const,
          userMessage: "Improve the overall visual hierarchy — make the page flow better from top to bottom",
          label: "edit-visual-hierarchy",
        },
      },
    ];
  },

  task: async (input: WebsiteEvalInput): Promise<WebsiteEvalOutput> => {
    if (input.type === "create") {
      return await runCreate(input);
    } else {
      return await runEdit(input);
    }
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
