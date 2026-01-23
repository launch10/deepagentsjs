#!/usr/bin/env npx tsx
/**
 * Verify Usage Tracking Implementation
 *
 * This script validates that our new usage tracking infrastructure produces
 * exactly the same token counts as manually extracting usage_metadata from
 * AIMessages (the approach used in explore-usage-metadata.ts, which has been
 * manually verified as correct).
 *
 * Verification approach:
 * 1. Run an agent with runWithUsageTracking() enabled
 * 2. Extract usage data via our callback handler (UsageRecord[])
 * 3. Also extract usage directly from AIMessages (like explore script does)
 * 4. Compare every field to ensure perfect match
 *
 * Usage:
 *   pnpm tsx scripts/verify-usage-tracking.ts           # Default (haiku)
 *   pnpm tsx scripts/verify-usage-tracking.ts --tier=2  # Sonnet
 *   pnpm tsx scripts/verify-usage-tracking.ts --tier=4  # gpt-5-mini
 */
import { z } from "zod";
import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  SystemMessage,
  BaseMessage,
  AIMessage,
} from "@langchain/core/messages";
import { getLLM } from "@core";
import { runWithUsageTracking, type UsageRecord } from "@core";

// =============================================================================
// Test Tools (same as explore-usage-metadata.ts)
// =============================================================================

const getBusinessInfoTool = tool(
  async (input: { aspect: string }) => {
    return `Business info for "${input.aspect}": This is a tech startup focused on AI-powered landing pages. Founded in 2024.`;
  },
  {
    name: "get_business_info",
    description:
      "Get information about a specific aspect of the business (e.g., 'founding', 'mission', 'product')",
    schema: z.object({
      aspect: z.string().describe("The aspect of the business to get info about"),
    }),
  }
);

const getCompetitorInfoTool = tool(
  async (input: { competitor: string }) => {
    return `Competitor analysis for "${input.competitor}": They offer similar services but lack AI capabilities. Market share ~15%.`;
  },
  {
    name: "get_competitor_info",
    description: "Get information about a specific competitor",
    schema: z.object({
      competitor: z.string().describe("The name of the competitor to analyze"),
    }),
  }
);

// =============================================================================
// Usage Extraction (matching explore-usage-metadata.ts exactly)
// =============================================================================

interface ExploreUsageData {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  model: string | null;
}

/**
 * Extract usage data from an AIMessage exactly like explore-usage-metadata.ts does.
 * This is the "ground truth" we're validating against.
 */
function extractUsageFromMessage(msg: BaseMessage): ExploreUsageData | null {
  const usage = (msg as any).usage_metadata;
  if (!usage) return null;

  const responseMeta = (msg as any).response_metadata;
  const model = responseMeta?.model_name || responseMeta?.model || null;

  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const reasoningTokens = usage.output_token_details?.reasoning || 0;
  // Handle both formats: Anthropic uses input_token_details.cache_creation, OpenAI might use cache_creation_input_tokens
  const cacheCreationTokens =
    usage.cache_creation_input_tokens || usage.input_token_details?.cache_creation || 0;
  const cacheReadTokens =
    usage.cache_read_input_tokens || usage.input_token_details?.cache_read || 0;

  return {
    inputTokens,
    outputTokens,
    reasoningTokens,
    cacheCreationTokens,
    cacheReadTokens,
    model,
  };
}

// =============================================================================
// Comparison Logic
// =============================================================================

interface ComparisonResult {
  match: boolean;
  messageId: string;
  field: string;
  tracked: number | string | null;
  expected: number | string | null;
}

function compareUsage(
  tracked: UsageRecord,
  expected: ExploreUsageData,
  messageId: string
): ComparisonResult[] {
  const results: ComparisonResult[] = [];

  const fieldsToCompare: Array<keyof ExploreUsageData> = [
    "inputTokens",
    "outputTokens",
    "reasoningTokens",
    "cacheCreationTokens",
    "cacheReadTokens",
    "model",
  ];

  for (const field of fieldsToCompare) {
    const trackedValue = tracked[field as keyof UsageRecord];
    const expectedValue = expected[field];

    results.push({
      match: trackedValue === expectedValue,
      messageId,
      field,
      tracked: trackedValue as number | string | null,
      expected: expectedValue as number | string | null,
    });
  }

  return results;
}

// =============================================================================
// Main Verification
// =============================================================================

async function main() {
  // Parse CLI args for --tier=N
  const tierArg = process.argv.find((arg) => arg.startsWith("--tier="));
  const maxTier = tierArg ? parseInt(tierArg.split("=")[1]!, 10) : 3;

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("   USAGE TRACKING VERIFICATION");
  console.log("══════════════════════════════════════════════════════════════\n");
  console.log(`Requesting maxTier: ${maxTier}`);
  console.log("  Tier 1 = opus (premium)");
  console.log("  Tier 2 = sonnet");
  console.log("  Tier 3 = haiku");
  console.log("  Tier 4-5 = gpt-5-mini, etc.\n");

  // Get LLM based on tier
  const llm = await getLLM({ maxTier });
  console.log("✅ LLM initialized\n");

  // System prompt (same as explore-usage-metadata.ts)
  const systemPrompt = `You are a helpful business analyst assistant specializing in competitive analysis and strategic planning.

## Your Expertise Areas

### Market Analysis
You have deep knowledge in analyzing market trends, identifying opportunities, and understanding competitive landscapes. You can evaluate market size, growth potential, and entry barriers for various industries.

### Competitive Intelligence
You excel at gathering and analyzing information about competitors, including their:
- Product offerings and feature sets
- Pricing strategies and business models
- Marketing approaches and brand positioning
- Strengths, weaknesses, opportunities, and threats (SWOT)
- Market share and growth trajectories

### Business Strategy
You can provide insights on:
- Go-to-market strategies
- Product differentiation approaches
- Competitive positioning
- Growth opportunities and market expansion
- Strategic partnerships and ecosystem development

## Guidelines for Analysis

1. **Be Thorough**: Always gather all available information before drawing conclusions
2. **Be Objective**: Present facts without bias, acknowledging both positives and negatives
3. **Be Actionable**: Provide concrete recommendations that can be implemented
4. **Be Clear**: Use simple language and structure your responses logically
5. **Use Tools**: When information is needed, use the available tools to gather data

## Response Format

When providing analysis, structure your responses with:
- Executive Summary
- Key Findings
- Detailed Analysis
- Recommendations
- Next Steps

Remember: Your goal is to help businesses make informed strategic decisions based on comprehensive analysis.`;

  // Create agent with tools
  const tools = [getBusinessInfoTool, getCompetitorInfoTool];
  const agent = await createAgent({
    model: llm,
    tools,
  });
  console.log("✅ Agent created with 2 tools\n");

  // Prompt that forces sequential tool calls (same as explore-usage-metadata.ts)
  const prompt = `
    I need you to do a comprehensive analysis. Please follow these steps IN ORDER:

    1. FIRST, call get_business_info with aspect="mission" to understand our business
    2. WAIT for the response before proceeding
    3. THEN call get_competitor_info with competitor="Competitor X" to analyze competition
    4. WAIT for that response
    5. FINALLY, produce a brief summary combining both insights

    This is important: do these steps one at a time, sequentially.
  `;

  console.log("📤 Invoking agent with tracking enabled...\n");

  // Run with our new usage tracking infrastructure
  const { result, usage, messagesProduced } = await runWithUsageTracking(
    { graphName: "verification-test" },
    () =>
      agent.invoke({
        messages: [new SystemMessage(systemPrompt), new HumanMessage(prompt)],
      })
  );

  const messages = result.messages as BaseMessage[];

  console.log("══════════════════════════════════════════════════════════════");
  console.log("   VERIFICATION RESULTS");
  console.log("══════════════════════════════════════════════════════════════\n");

  // Filter to AIMessages only (same as explore script)
  const aiMessages = messages.filter((m) => m instanceof AIMessage);
  console.log(`Total messages: ${messages.length}`);
  console.log(`AI messages: ${aiMessages.length}`);
  console.log(`Tracked usage records: ${usage.length}`);
  console.log(`Messages produced via callback: ${messagesProduced.length}\n`);

  // First verification: usage.length should equal messagesProduced.length
  if (usage.length !== messagesProduced.length) {
    console.log("❌ FAIL: Usage record count doesn't match messages produced count");
    console.log(`   Usage records: ${usage.length}`);
    console.log(`   Messages produced: ${messagesProduced.length}`);
    process.exit(1);
  }
  console.log("✅ Usage record count matches messages produced count\n");

  // Build a map of messageId -> UsageRecord for lookup
  const usageByMessageId = new Map<string, UsageRecord>();
  for (const record of usage) {
    usageByMessageId.set(record.messageId, record);
  }

  // Compare each message's usage_metadata with our tracked UsageRecord
  console.log("══════════════════════════════════════════════════════════════");
  console.log("   FIELD-BY-FIELD COMPARISON");
  console.log("══════════════════════════════════════════════════════════════\n");

  let allMatch = true;
  let comparedCount = 0;

  for (let i = 0; i < messagesProduced.length; i++) {
    const msg = messagesProduced[i]!;
    const messageId = msg.id || "";
    const trackedRecord = usageByMessageId.get(messageId);

    // Extract usage directly from the message (the "ground truth")
    const expectedUsage = extractUsageFromMessage(msg);

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Message ${i + 1}: ${messageId.slice(0, 30)}...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    if (!expectedUsage) {
      console.log("   ⚠️ No usage_metadata on message");
      continue;
    }

    if (!trackedRecord) {
      console.log("   ❌ No tracked record found for this messageId");
      allMatch = false;
      continue;
    }

    comparedCount++;
    const comparisons = compareUsage(trackedRecord, expectedUsage, messageId);

    for (const comp of comparisons) {
      const status = comp.match ? "✅" : "❌";
      const mismatchDetail = comp.match
        ? ""
        : ` (tracked=${comp.tracked}, expected=${comp.expected})`;
      console.log(`   ${status} ${comp.field.padEnd(20)} ${comp.tracked}${mismatchDetail}`);

      if (!comp.match) {
        allMatch = false;
      }
    }
    console.log();
  }

  // Summary
  console.log("══════════════════════════════════════════════════════════════");
  console.log("   SUMMARY");
  console.log("══════════════════════════════════════════════════════════════\n");

  // Also verify totals match (like explore script does)
  const totalTrackedInput = usage.reduce((sum, r) => sum + r.inputTokens, 0);
  const totalTrackedOutput = usage.reduce((sum, r) => sum + r.outputTokens, 0);
  const totalTrackedReasoning = usage.reduce((sum, r) => sum + r.reasoningTokens, 0);
  const totalTrackedCacheCreation = usage.reduce((sum, r) => sum + r.cacheCreationTokens, 0);
  const totalTrackedCacheRead = usage.reduce((sum, r) => sum + r.cacheReadTokens, 0);

  const totalExpectedInput = messagesProduced.reduce(
    (sum, m) => sum + ((m as any).usage_metadata?.input_tokens || 0),
    0
  );
  const totalExpectedOutput = messagesProduced.reduce(
    (sum, m) => sum + ((m as any).usage_metadata?.output_tokens || 0),
    0
  );
  const totalExpectedReasoning = messagesProduced.reduce(
    (sum, m) => sum + ((m as any).usage_metadata?.output_token_details?.reasoning || 0),
    0
  );
  const totalExpectedCacheCreation = messagesProduced.reduce((sum, m) => {
    const usage = (m as any).usage_metadata;
    return (
      sum + (usage?.cache_creation_input_tokens || usage?.input_token_details?.cache_creation || 0)
    );
  }, 0);
  const totalExpectedCacheRead = messagesProduced.reduce((sum, m) => {
    const usage = (m as any).usage_metadata;
    return sum + (usage?.cache_read_input_tokens || usage?.input_token_details?.cache_read || 0);
  }, 0);

  console.log("Token Totals Comparison:");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`                    | Tracked  | Expected | Match`);
  console.log(`─────────────────────────────────────────────────────────────`);
  console.log(
    `Input tokens        | ${String(totalTrackedInput).padEnd(8)} | ${String(totalExpectedInput).padEnd(8)} | ${totalTrackedInput === totalExpectedInput ? "✅" : "❌"}`
  );
  console.log(
    `Output tokens       | ${String(totalTrackedOutput).padEnd(8)} | ${String(totalExpectedOutput).padEnd(8)} | ${totalTrackedOutput === totalExpectedOutput ? "✅" : "❌"}`
  );
  console.log(
    `Reasoning tokens    | ${String(totalTrackedReasoning).padEnd(8)} | ${String(totalExpectedReasoning).padEnd(8)} | ${totalTrackedReasoning === totalExpectedReasoning ? "✅" : "❌"}`
  );
  console.log(
    `Cache creation      | ${String(totalTrackedCacheCreation).padEnd(8)} | ${String(totalExpectedCacheCreation).padEnd(8)} | ${totalTrackedCacheCreation === totalExpectedCacheCreation ? "✅" : "❌"}`
  );
  console.log(
    `Cache read          | ${String(totalTrackedCacheRead).padEnd(8)} | ${String(totalExpectedCacheRead).padEnd(8)} | ${totalTrackedCacheRead === totalExpectedCacheRead ? "✅" : "❌"}`
  );
  console.log(`─────────────────────────────────────────────────────────────\n`);

  // Check totals match
  const totalsMatch =
    totalTrackedInput === totalExpectedInput &&
    totalTrackedOutput === totalExpectedOutput &&
    totalTrackedReasoning === totalExpectedReasoning &&
    totalTrackedCacheCreation === totalExpectedCacheCreation &&
    totalTrackedCacheRead === totalExpectedCacheRead;

  if (allMatch && totalsMatch) {
    console.log("══════════════════════════════════════════════════════════════");
    console.log("   ✅ VERIFICATION PASSED");
    console.log("══════════════════════════════════════════════════════════════");
    console.log("\nOur usage tracking implementation produces EXACTLY the same");
    console.log("token counts as direct AIMessage.usage_metadata extraction.");
    console.log(`\nVerified ${comparedCount} usage records across ${messagesProduced.length} messages.\n`);
    process.exit(0);
  } else {
    console.log("══════════════════════════════════════════════════════════════");
    console.log("   ❌ VERIFICATION FAILED");
    console.log("══════════════════════════════════════════════════════════════");
    console.log("\nMismatches detected between tracked usage and AIMessage metadata.");
    console.log("Review the field-by-field comparison above for details.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
