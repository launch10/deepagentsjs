#!/usr/bin/env npx tsx
/**
 * Explore usage_metadata on Langgraph messages
 *
 * This script creates a simple agent with 2 tools and invokes it
 * with a prompt that encourages sequential tool calls:
 *   call tool1 → wait → call tool2 → produce output
 *
 * We then log all messages with their usage_metadata to verify assumptions
 * about which message types have usage data.
 *
 * Usage:
 *   pnpm tsx scripts/explore-usage-metadata.ts           # Default tier 4 (gpt-5-mini)
 *   pnpm tsx scripts/explore-usage-metadata.ts --tier=3  # Tier 3 (haiku)
 *   pnpm tsx scripts/explore-usage-metadata.ts --tier=2  # Tier 2 (sonnet)
 */
import { z } from "zod";
import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  SystemMessage,
  BaseMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { getLLM } from "@core";

// Simple tool 1: Returns information about a business
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

// Simple tool 2: Returns competitor analysis
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

// Pricing table (costs per 1M tokens)
// cost_reasoning defaults to cost_out if not specified
const MODEL_PRICING: Record<
  string,
  {
    cost_in: number;
    cost_out: number;
    cost_reasoning?: number;
    cache_writes?: number;
    cache_reads?: number;
  }
> = {
  // OpenAI models
  "gpt-5-mini": { cost_in: 0.25, cost_out: 2.0, cost_reasoning: 2.0 },
  "openai/gpt-oss-120b": { cost_in: 0.15, cost_out: 0.6 },

  // Anthropic Claude 4 series
  "claude-opus-4-5": { cost_in: 5.0, cost_out: 25.0, cache_writes: 10.0, cache_reads: 0.5 },
  "claude-sonnet-4-5": { cost_in: 3.0, cost_out: 15.0, cache_writes: 6.0, cache_reads: 0.3 },
  "claude-haiku-4-5": { cost_in: 1.0, cost_out: 5.0, cache_writes: 2.0, cache_reads: 0.1 },

  // Anthropic Claude 3.5 series
  "claude-3-5-haiku-latest": { cost_in: 0.8, cost_out: 4.0, cache_writes: 1.6, cache_reads: 0.08 },
  "claude-3-5-haiku": { cost_in: 0.8, cost_out: 4.0, cache_writes: 1.6, cache_reads: 0.08 },
  "claude-3-5-sonnet": { cost_in: 3.0, cost_out: 15.0, cache_writes: 3.75, cache_reads: 0.3 },
  "claude-3-5-sonnet-latest": {
    cost_in: 3.0,
    cost_out: 15.0,
    cache_writes: 3.75,
    cache_reads: 0.3,
  },
};

/**
 * Normalize model name by finding the longest known model that matches
 * e.g., "gpt-5-mini-2025-08-07" -> "gpt-5-mini"
 * e.g., "claude-haiku-4-5-20251001" -> "claude-haiku-4-5"
 */
function normalizeModelName(modelName: string): string {
  // Find all known models that the reported name starts with
  const knownModels = Object.keys(MODEL_PRICING);
  const matches = knownModels.filter((known) => modelName.startsWith(known));

  // Return the longest match (most specific), or original if no match
  if (matches.length > 0) {
    return matches.reduce((longest, current) =>
      current.length > longest.length ? current : longest
    );
  }

  return modelName;
}

function getModelFromMessage(msg: BaseMessage): string | null {
  const responseMeta = (msg as any).response_metadata;
  // OpenAI uses model_name, Anthropic uses model
  return responseMeta?.model_name || responseMeta?.model || null;
}

function getReasoningTokens(msg: BaseMessage): number {
  const usage = (msg as any).usage_metadata;
  return usage?.output_token_details?.reasoning || 0;
}

function calculateCost(msg: BaseMessage): {
  cost: number;
  model: string | null;
  normalizedModel: string | null;
  breakdown: Record<string, number>;
} {
  const usage = (msg as any).usage_metadata;
  if (!usage) return { cost: 0, model: null, normalizedModel: null, breakdown: {} };

  const model = getModelFromMessage(msg);
  if (!model) return { cost: 0, model: null, normalizedModel: null, breakdown: {} };

  const normalizedModel = normalizeModelName(model);
  const pricing = MODEL_PRICING[normalizedModel];
  if (!pricing) {
    console.warn(`⚠️ No pricing found for model: ${model} (normalized: ${normalizedModel})`);
    return { cost: 0, model, normalizedModel, breakdown: {} };
  }

  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const reasoningTokens = usage.output_token_details?.reasoning || 0;
  // Handle both formats: Anthropic uses input_token_details.cache_creation, OpenAI might use cache_creation_input_tokens
  const cacheCreationTokens =
    usage.cache_creation_input_tokens || usage.input_token_details?.cache_creation || 0;
  const cacheReadTokens =
    usage.cache_read_input_tokens || usage.input_token_details?.cache_read || 0;

  // IMPORTANT: Reasoning tokens are part of output_tokens, not additional
  // So we charge: (output - reasoning) at output rate + reasoning at reasoning rate
  const nonReasoningOutput = outputTokens - reasoningTokens;
  const reasoningRate = pricing.cost_reasoning ?? pricing.cost_out;

  const breakdown: Record<string, number> = {};
  breakdown.input = (inputTokens / 1_000_000) * pricing.cost_in;
  breakdown.output = (nonReasoningOutput / 1_000_000) * pricing.cost_out;
  breakdown.reasoning = (reasoningTokens / 1_000_000) * reasoningRate;

  if (pricing.cache_writes && cacheCreationTokens > 0) {
    breakdown.cache_writes = (cacheCreationTokens / 1_000_000) * pricing.cache_writes;
  }
  if (pricing.cache_reads && cacheReadTokens > 0) {
    breakdown.cache_reads = (cacheReadTokens / 1_000_000) * pricing.cache_reads;
  }

  const cost = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  return { cost, model, normalizedModel, breakdown };
}

function formatCost(cost: number): string {
  if (cost === 0) return "N/A";
  if (cost < 0.0001) return `$${cost.toFixed(8)}`;
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

function getMessageTypeName(msg: BaseMessage): string {
  if (msg instanceof AIMessage) return "AIMessage";
  if (msg instanceof ToolMessage) return "ToolMessage";
  if (msg instanceof HumanMessage) return "HumanMessage";
  return msg.constructor.name;
}

function formatUsageMetadata(msg: BaseMessage): string {
  const usage = (msg as any).usage_metadata;
  if (!usage) return "NO USAGE_METADATA";

  return JSON.stringify(usage, null, 2);
}

function formatResponseMetadata(msg: BaseMessage): string {
  const response = (msg as any).response_metadata;
  if (!response) return "NO RESPONSE_METADATA";

  // Just show the top-level keys to avoid huge output
  return `keys: [${Object.keys(response).join(", ")}]`;
}

async function main() {
  // Parse CLI args for --tier=N
  const tierArg = process.argv.find((arg) => arg.startsWith("--tier="));
  const maxTier = tierArg ? parseInt(tierArg.split("=")[1]!, 10) : 3;

  console.log("\n==============================================");
  console.log("   USAGE METADATA EXPLORATION");
  console.log("==============================================\n");
  console.log(`Requesting maxTier: ${maxTier}`);
  console.log("  Tier 1 = opus (premium)");
  console.log("  Tier 2 = sonnet");
  console.log("  Tier 3 = haiku");
  console.log("  Tier 4-5 = gpt-5-mini, etc.\n");

  // Get LLM based on tier
  const llm = await getLLM({ maxTier });
  console.log("✅ LLM initialized\n");

  // System prompt - needs to be long enough to trigger caching (typically 1024+ tokens)
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
  console.log(
    `System prompt length: ~${systemPrompt.split(/\s+/).length} words (should trigger caching)\n`
  );

  // Invoke with a prompt that forces sequential tool calls
  const prompt = `
    I need you to do a comprehensive analysis. Please follow these steps IN ORDER:

    1. FIRST, call get_business_info with aspect="mission" to understand our business
    2. WAIT for the response before proceeding
    3. THEN call get_competitor_info with competitor="Competitor X" to analyze competition
    4. WAIT for that response
    5. FINALLY, produce a brief summary combining both insights

    This is important: do these steps one at a time, sequentially.
  `;

  console.log("📤 Invoking agent with prompt:\n");
  console.log(prompt);
  console.log("\n----------------------------------------------\n");

  const result = await agent.invoke({
    messages: [new SystemMessage(systemPrompt), new HumanMessage(prompt)],
  });

  console.log("\n==============================================");
  console.log("   MESSAGE ANALYSIS");
  console.log("==============================================\n");

  const messages = result.messages as BaseMessage[];
  console.log(`Total messages in result: ${messages.length}\n`);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const typeName = getMessageTypeName(msg);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📨 MESSAGE ${i + 1}: ${typeName}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Content preview
    const content =
      typeof msg.content === "string"
        ? msg.content.slice(0, 200) + (msg.content.length > 200 ? "..." : "")
        : JSON.stringify(msg.content).slice(0, 200);
    console.log(`\n📝 Content preview:\n${content}`);

    // Tool calls (for AIMessage)
    if (msg instanceof AIMessage && (msg as any).tool_calls?.length > 0) {
      console.log(`\n🔧 Tool calls:`);
      for (const tc of (msg as any).tool_calls) {
        console.log(`   - ${tc.name}(${JSON.stringify(tc.args)})`);
      }
    }

    // Tool call ID (for ToolMessage)
    if (msg instanceof ToolMessage) {
      console.log(`\n🔗 tool_call_id: ${(msg as ToolMessage).tool_call_id}`);
    }

    // Usage metadata
    console.log(`\n📊 usage_metadata:\n${formatUsageMetadata(msg)}`);

    // Response metadata (just keys)
    console.log(`\n📋 response_metadata: ${formatResponseMetadata(msg)}`);
  }

  console.log("\n\n==============================================");
  console.log("   SUMMARY TABLE");
  console.log("==============================================\n");

  // Detect model from first AIMessage
  const firstAI = messages.find((m) => m instanceof AIMessage);
  const detectedModel = firstAI ? getModelFromMessage(firstAI) : "unknown";
  const normalizedModel = detectedModel ? normalizeModelName(detectedModel) : "unknown";
  console.log(`Model detected: ${detectedModel}`);
  console.log(`Normalized to:  ${normalizedModel}\n`);

  console.log("| # | Type        | Has Usage? | Input  | Output | Reasoning | Cost USD    |");
  console.log("|---|-------------|------------|--------|--------|-----------|-------------|");

  let totalCost = 0;
  let totalReasoning = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const typeName = getMessageTypeName(msg).padEnd(11);
    const usage = (msg as any).usage_metadata;
    const hasUsage = usage ? "✓ Yes" : "✗ No ";
    const inputTokens = usage?.input_tokens?.toString().padStart(6) || "N/A".padStart(6);
    const outputTokens = usage?.output_tokens?.toString().padStart(6) || "N/A".padStart(6);
    const reasoningTokens = usage?.output_token_details?.reasoning || 0;
    totalReasoning += reasoningTokens;
    const reasoningStr =
      reasoningTokens > 0 ? reasoningTokens.toString().padStart(9) : "0".padStart(9);

    const { cost } = calculateCost(msg);
    totalCost += cost;
    const costStr = formatCost(cost).padStart(11);

    console.log(
      `| ${i + 1} | ${typeName} | ${hasUsage}     | ${inputTokens} | ${outputTokens} | ${reasoningStr} | ${costStr} |`
    );
  }

  // Calculate totals - handle both Anthropic and OpenAI cache token formats
  const aiMessages = messages.filter((m) => m instanceof AIMessage);
  const totalInput = aiMessages.reduce(
    (sum, m) => sum + ((m as any).usage_metadata?.input_tokens || 0),
    0
  );
  const totalOutput = aiMessages.reduce(
    (sum, m) => sum + ((m as any).usage_metadata?.output_tokens || 0),
    0
  );
  const totalCacheCreation = aiMessages.reduce((sum, m) => {
    const usage = (m as any).usage_metadata;
    return (
      sum + (usage?.cache_creation_input_tokens || usage?.input_token_details?.cache_creation || 0)
    );
  }, 0);
  const totalCacheRead = aiMessages.reduce((sum, m) => {
    const usage = (m as any).usage_metadata;
    return sum + (usage?.cache_read_input_tokens || usage?.input_token_details?.cache_read || 0);
  }, 0);

  console.log("|---|-------------|------------|--------|--------|-----------|-------------|");
  console.log(
    `|   | TOTAL       |            | ${totalInput.toString().padStart(6)} | ${totalOutput.toString().padStart(6)} | ${totalReasoning.toString().padStart(9)} | ${formatCost(totalCost).padStart(11)} |`
  );

  console.log("\n----------------------------------------------");
  console.log(
    `AIMessages with usage_metadata: ${aiMessages.filter((m) => (m as any).usage_metadata).length}/${aiMessages.length}`
  );
  console.log(
    `ToolMessages with usage_metadata: ${messages.filter((m) => m instanceof ToolMessage && (m as any).usage_metadata).length}/${messages.filter((m) => m instanceof ToolMessage).length}`
  );
  console.log("\n📈 TOTALS (sum across all AIMessages):");
  console.log(`   Input tokens:           ${totalInput}`);
  console.log(`   Output tokens:          ${totalOutput}`);
  console.log(`   Reasoning tokens:       ${totalReasoning} (included in output)`);
  console.log(`   Cache creation tokens:  ${totalCacheCreation}`);
  console.log(`   Cache read tokens:      ${totalCacheRead}`);
  console.log(`   ─────────────────────────────────────`);
  console.log(`   TOTAL COST:             ${formatCost(totalCost)}`);

  // Show cost breakdown
  const pricing = MODEL_PRICING[normalizedModel || ""];
  if (pricing) {
    const reasoningRate = pricing.cost_reasoning ?? pricing.cost_out;
    const nonReasoningOutput = totalOutput - totalReasoning;

    console.log(`\n💰 Cost Breakdown (${normalizedModel}):`);
    console.log(
      `   Input:     ${totalInput} tokens × $${pricing.cost_in}/1M = $${((totalInput / 1_000_000) * pricing.cost_in).toFixed(6)}`
    );
    console.log(
      `   Output:    ${nonReasoningOutput} tokens × $${pricing.cost_out}/1M = $${((nonReasoningOutput / 1_000_000) * pricing.cost_out).toFixed(6)}`
    );
    if (totalReasoning > 0) {
      console.log(
        `   Reasoning: ${totalReasoning} tokens × $${reasoningRate}/1M = $${((totalReasoning / 1_000_000) * reasoningRate).toFixed(6)}`
      );
    }
    if (pricing.cache_writes && totalCacheCreation > 0) {
      console.log(
        `   Cache writes: ${totalCacheCreation} tokens × $${pricing.cache_writes}/1M = $${((totalCacheCreation / 1_000_000) * pricing.cache_writes).toFixed(6)}`
      );
    }
    if (pricing.cache_reads && totalCacheRead > 0) {
      console.log(
        `   Cache reads:  ${totalCacheRead} tokens × $${pricing.cache_reads}/1M = $${((totalCacheRead / 1_000_000) * pricing.cache_reads).toFixed(6)}`
      );
    }
  }

  console.log("\n✅ Exploration complete!\n");
}

main().catch(console.error);
