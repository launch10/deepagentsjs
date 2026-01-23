import { describe, it, expect, beforeAll } from "vitest";
import { testGraph } from "@support";
import { DatabaseSnapshotter } from "@services";
import {
  usageTrackingTestGraph,
  type UsageTrackingTestState,
} from "./usageTrackingTestGraph";
import { MemorySaver } from "@langchain/langgraph";

// =====================================================
// Integration with Real Graph Patterns
// =====================================================
// NOTE: These tests require real LLM calls. They are marked as integration
// tests and use Polly for HTTP recording/replay.
// The test graph exercises all LLM call patterns:
// - direct: Simple getLLM().invoke()
// - agent: Multi-turn agent with tool loops
// - tool-llm: Tool that internally calls getLLM()
// - middleware: Node with middleware that calls LLM

describe("Usage Tracking Integration", () => {
  // Restore database snapshot with valid LLM configurations
  beforeAll(async () => {
    await DatabaseSnapshotter.restoreSnapshot("basic_account");
  }, 30000);

  // Compile the graph once for all integration tests
  const compiledGraph = usageTrackingTestGraph.compile({
    checkpointer: new MemorySaver(),
  });

  describe("direct model.invoke()", () => {
    it("fires handleLLMEnd and captures usage with runId", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Say 'hello world' and nothing else")
        .withState({ scenario: "direct" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.tracking).toBeDefined();
      expect(result.tracking!.usage.length).toBeGreaterThan(0);

      // Verify usage record has expected fields
      const record = result.tracking!.usage[0]!;
      expect(record.model).toBeDefined();
      expect(record.runId).toBeDefined();
      expect(record.runId.length).toBeGreaterThan(0);
      expect(record.inputTokens).toBeGreaterThan(0);
      expect(record.outputTokens).toBeGreaterThan(0);
    });

    it("captures correct input_tokens and output_tokens matching AIMessage metadata", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Respond with exactly: OK")
        .withState({ scenario: "direct" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      const record = result.tracking!.usage[0]!;
      const message = result.tracking!.messagesProduced[0]!;
      const messageUsage = (message as any).usage_metadata;

      // Tracked usage should match the AIMessage's usage_metadata exactly
      expect(record.inputTokens).toBe(messageUsage.input_tokens);
      expect(record.outputTokens).toBe(messageUsage.output_tokens);

      // Also verify messageId correlates them
      expect(record.messageId).toBe(message.id);
    });

    it("correlates usage records with messages produced via messageId", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Say 'traced response'")
        .withState({ scenario: "direct" })
        .withTracking()
        .execute();

      expect(result.tracking!.messagesProduced.length).toBeGreaterThan(0);
      expect(result.tracking!.usage.length).toBe(result.tracking!.messagesProduced.length);

      // Each usage record's messageId should match an AIMessage.id
      for (const record of result.tracking!.usage) {
        const message = result.tracking!.messagesProduced.find((m) => m.id === record.messageId);
        expect(message).toBeDefined();

        // Usage should match the message's metadata
        const messageUsage = (message as any).usage_metadata;
        expect(record.inputTokens).toBe(messageUsage.input_tokens);
        expect(record.outputTokens).toBe(messageUsage.output_tokens);
      }
    });
  });

  describe("agent tool loops", () => {
    it("tracks every LLM call with usage matching AIMessage metadata", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Use the echo tool once to say 'test'")
        .withState({ scenario: "agent", iterationCount: 1 })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();

      // Every usage record must have a corresponding AIMessage with matching metadata
      expect(result.tracking!.usage.length).toBe(result.tracking!.messagesProduced.length);

      for (const record of result.tracking!.usage) {
        const message = result.tracking!.messagesProduced.find((m) => m.id === record.messageId);
        expect(message).toBeDefined();

        const messageUsage = (message as any).usage_metadata;
        expect(record.inputTokens).toBe(messageUsage.input_tokens);
        expect(record.outputTokens).toBe(messageUsage.output_tokens);
        expect(record.runId).toBeDefined();
      }

      // All records share the same runId
      const runIds = new Set(result.tracking!.usage.map((r) => r.runId));
      expect(runIds.size).toBe(1);
    });

    it("multi-turn agent: each turn's usage matches its AIMessage", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Use the echo tool 2 times")
        .withState({ scenario: "agent", iterationCount: 2 })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();

      // Every record correlates with a message
      expect(result.tracking!.usage.length).toBe(result.tracking!.messagesProduced.length);

      for (const record of result.tracking!.usage) {
        const message = result.tracking!.messagesProduced.find((m) => m.id === record.messageId);
        expect(message).toBeDefined();

        const messageUsage = (message as any).usage_metadata;
        expect(record.inputTokens).toBe(messageUsage.input_tokens);
        expect(record.outputTokens).toBe(messageUsage.output_tokens);
      }

      // All from same run
      const runIds = new Set(result.tracking!.usage.map((r) => r.runId));
      expect(runIds.size).toBe(1);
    });
  });

  describe("tools calling getLLM() internally", () => {
    it("tool-internal LLM call: usage matches AIMessage metadata", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Summarize some text")
        .withState({ scenario: "tool-llm" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();

      // Every usage record must match its AIMessage
      expect(result.tracking!.usage.length).toBe(result.tracking!.messagesProduced.length);

      for (const record of result.tracking!.usage) {
        const message = result.tracking!.messagesProduced.find((m) => m.id === record.messageId);
        expect(message).toBeDefined();

        const messageUsage = (message as any).usage_metadata;
        expect(record.inputTokens).toBe(messageUsage.input_tokens);
        expect(record.outputTokens).toBe(messageUsage.output_tokens);
      }

      // All from same run
      const runIds = new Set(result.tracking!.usage.map((r) => r.runId));
      expect(runIds.size).toBe(1);
    });

    it("AsyncLocalStorage context survives into tool callback", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Summarize text")
        .withState({ scenario: "tool-llm" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      // The tool sets toolSawContext=true if it could access getUsageContext()
      expect(result.state.toolSawContext).toBe(true);

      // And the tool's LLM call was tracked with matching metadata
      expect(result.tracking!.usage.length).toBe(result.tracking!.messagesProduced.length);
    });
  });

  describe("middleware that calls LLMs", () => {
    it("agent + middleware LLM calls: each usage matches its AIMessage", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Tell me a joke")
        .withState({ scenario: "middleware" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();

      // Every usage record must have a corresponding AIMessage
      expect(result.tracking!.usage.length).toBe(result.tracking!.messagesProduced.length);

      for (const record of result.tracking!.usage) {
        const message = result.tracking!.messagesProduced.find((m) => m.id === record.messageId);
        expect(message).toBeDefined();

        const messageUsage = (message as any).usage_metadata;
        expect(record.inputTokens).toBe(messageUsage.input_tokens);
        expect(record.outputTokens).toBe(messageUsage.output_tokens);
      }

      // All from same run
      const runIds = new Set(result.tracking!.usage.map((r) => r.runId));
      expect(runIds.size).toBe(1);
    });

    it("middleware LLM call usage matches its AIMessage metadata exactly", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Tell me something funny")
        .withState({ scenario: "middleware" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();

      // Every usage record correlates with exactly one AIMessage
      expect(result.tracking!.usage.length).toBe(result.tracking!.messagesProduced.length);

      // Sum tracked usage
      const totalTrackedInput = result.tracking!.usage.reduce((sum, r) => sum + r.inputTokens, 0);
      const totalTrackedOutput = result.tracking!.usage.reduce((sum, r) => sum + r.outputTokens, 0);

      // Sum AIMessage usage_metadata
      const totalMessageInput = result.tracking!.messagesProduced.reduce(
        (sum, m) => sum + ((m as any).usage_metadata?.input_tokens || 0),
        0
      );
      const totalMessageOutput = result.tracking!.messagesProduced.reduce(
        (sum, m) => sum + ((m as any).usage_metadata?.output_tokens || 0),
        0
      );

      // Tracked totals must match AIMessage totals exactly
      expect(totalTrackedInput).toBe(totalMessageInput);
      expect(totalTrackedOutput).toBe(totalMessageOutput);
    });
  });

  describe("multi-turn state resumption (no double-counting)", () => {
    it("run2 resuming from run1 state: each run tracks only its own LLM calls", async () => {
      // Run 1: Initial conversation turn
      const run1 = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Say hello")
        .withState({ scenario: "direct" })
        .withTracking()
        .execute();

      expect(run1.error).toBeUndefined();
      const run1RecordCount = run1.tracking!.usage.length;
      const run1MessageCount = run1.tracking!.messagesProduced.length;
      expect(run1RecordCount).toBe(run1MessageCount);

      // Run 2: Resume from run1's state with a new message
      const run2 = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withState({
          ...run1.state,
          scenario: "direct",
        })
        .withPrompt("Now say goodbye")
        .withTracking()
        .execute();

      expect(run2.error).toBeUndefined();
      const run2RecordCount = run2.tracking!.usage.length;
      const run2MessageCount = run2.tracking!.messagesProduced.length;

      // CRITICAL: Run 2 should only track its own LLM calls, not run1's
      expect(run2RecordCount).toBe(run2MessageCount);

      // Different runIds
      expect(run1.tracking!.usage[0]!.runId).not.toBe(run2.tracking!.usage[0]!.runId);

      // Run 2's usage should NOT include run1's records
      const run1MessageIds = new Set(run1.tracking!.usage.map((r) => r.messageId));
      const run2MessageIds = new Set(run2.tracking!.usage.map((r) => r.messageId));

      // No overlap in messageIds - proves no double-counting
      for (const id of run2MessageIds) {
        expect(run1MessageIds.has(id)).toBe(false);
      }
    });

    it("three sequential turns: each run isolated with distinct runIds", async () => {
      // Turn 1
      const turn1 = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Count to 1")
        .withState({ scenario: "direct" })
        .withTracking()
        .execute();

      expect(turn1.error).toBeUndefined();

      // Turn 2: resume from turn1
      const turn2 = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withState({ ...turn1.state, scenario: "direct" })
        .withPrompt("Count to 2")
        .withTracking()
        .execute();

      expect(turn2.error).toBeUndefined();

      // Turn 3: resume from turn2
      const turn3 = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withState({ ...turn2.state, scenario: "direct" })
        .withPrompt("Count to 3")
        .withTracking()
        .execute();

      expect(turn3.error).toBeUndefined();

      // Each turn has distinct runId
      const runIds = [
        turn1.tracking!.usage[0]!.runId,
        turn2.tracking!.usage[0]!.runId,
        turn3.tracking!.usage[0]!.runId,
      ];
      expect(new Set(runIds).size).toBe(3);

      // Each turn's usage count matches its messages
      expect(turn1.tracking!.usage.length).toBe(turn1.tracking!.messagesProduced.length);
      expect(turn2.tracking!.usage.length).toBe(turn2.tracking!.messagesProduced.length);
      expect(turn3.tracking!.usage.length).toBe(turn3.tracking!.messagesProduced.length);

      // No messageId overlap across turns
      const allMessageIds = [
        ...turn1.tracking!.usage.map((r) => r.messageId),
        ...turn2.tracking!.usage.map((r) => r.messageId),
        ...turn3.tracking!.usage.map((r) => r.messageId),
      ];
      expect(new Set(allMessageIds).size).toBe(allMessageIds.length);

      // Each turn's usage matches its AIMessage metadata exactly
      for (const turn of [turn1, turn2, turn3]) {
        for (const record of turn.tracking!.usage) {
          const message = turn.tracking!.messagesProduced.find((m) => m.id === record.messageId);
          expect(message).toBeDefined();

          const messageUsage = (message as any).usage_metadata;
          expect(record.inputTokens).toBe(messageUsage.input_tokens);
          expect(record.outputTokens).toBe(messageUsage.output_tokens);
        }
      }
    });
  });

  // =====================================================
  // Error Scenarios
  // =====================================================
  // Tests that usage is captured even when the graph fails.
  // This is critical for billing - we pay for LLM calls that succeed,
  // even if downstream processing fails.
  describe("error scenarios", () => {
    it("captures usage for successful LLM calls before an error", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Say hello before the error")
        .withState({ scenario: "error-after-success" })
        .withTracking()
        .execute();

      // The graph should have thrown an error
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain("Intentional test error");

      // But usage should still be captured - this is the key assertion!
      expect(result.tracking).toBeDefined();
      expect(result.tracking!.usage.length).toBeGreaterThan(0);

      // The successful LLM call before the error was tracked
      const record = result.tracking!.usage[0]!;
      expect(record.inputTokens).toBeGreaterThan(0);
      expect(record.outputTokens).toBeGreaterThan(0);
      expect(record.runId).toBeDefined();
    });

    it("returns partial usage when graph throws after multiple LLM calls", async () => {
      // This tests that we don't lose any usage data on error
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Process this before failing")
        .withState({ scenario: "error-after-success" })
        .withTracking()
        .execute();

      expect(result.error).toBeDefined();

      // Each usage record should still have valid data
      for (const record of result.tracking!.usage) {
        expect(record.model).toBeDefined();
        expect(record.runId).toBeDefined();
        expect(record.messageId).toBeDefined();
        expect(record.inputTokens).toBeGreaterThanOrEqual(0);
        expect(record.outputTokens).toBeGreaterThanOrEqual(0);
      }

      // Messages produced should match usage records
      expect(result.tracking!.messagesProduced.length).toBe(result.tracking!.usage.length);
      expect(result.tracking!.messagesProduced.length).toBeGreaterThan(0);
    });
  });

  // =====================================================
  // Subgraph/Nested Graph Support
  // =====================================================
  // Tests that AsyncLocalStorage context is preserved through subgraph invocations.
  // This is critical because production graphs use subgraphs (e.g., website builder
  // calls coding subgraph).
  describe("subgraph support", () => {
    it("AsyncLocalStorage context survives into subgraph", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Test subgraph context")
        .withState({ scenario: "subgraph" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();

      // The subgraph's node set toolSawContext=true if it could access getUsageContext()
      expect(result.state.toolSawContext).toBe(true);
    });

    it("LLM calls in subgraph are attributed to parent run", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Test subgraph tracking")
        .withState({ scenario: "subgraph" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.tracking).toBeDefined();

      // Should have at least 2 usage records:
      // 1. Parent's LLM call ("I am the parent")
      // 2. Child subgraph's LLM call ("I am the child subgraph")
      expect(result.tracking!.usage.length).toBeGreaterThanOrEqual(2);

      // All LLM calls share the same runId (attributed to parent)
      const runIds = new Set(result.tracking!.usage.map((r) => r.runId));
      expect(runIds.size).toBe(1);

      // Each usage record matches its corresponding AIMessage
      for (const record of result.tracking!.usage) {
        const message = result.tracking!.messagesProduced.find((m) => m.id === record.messageId);
        expect(message).toBeDefined();

        const messageUsage = (message as any).usage_metadata;
        expect(record.inputTokens).toBe(messageUsage.input_tokens);
        expect(record.outputTokens).toBe(messageUsage.output_tokens);
      }

      expect(result.tracking?.messagesProduced.at(0)?.content).toBe("I am the parent");
      expect(result.tracking?.messagesProduced.at(-1)?.content).toBe("I am the child subgraph");
    });

    it("subgraph messages are captured in tracking results", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Test subgraph messages")
        .withState({ scenario: "subgraph" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();

      // Messages from both parent and child should be captured
      expect(result.tracking!.messagesProduced.length).toBeGreaterThanOrEqual(2);

      // Usage count should match message count
      expect(result.tracking!.usage.length).toBe(result.tracking!.messagesProduced.length);
    });
  });

  // =====================================================
  // Cache Token Handling
  // =====================================================
  // Tests that cache tokens are correctly extracted from provider responses.
  // Anthropic returns cache_creation_input_tokens and cache_read_input_tokens,
  // while OpenAI may not include these fields.
  describe("cache token handling", () => {
    it("extracts cache tokens when present in usage_metadata", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Say hello for cache test")
        .withState({ scenario: "direct" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.tracking!.usage.length).toBeGreaterThan(0);

      const record = result.tracking!.usage[0]!;

      // Cache tokens should be numbers (may be 0 if caching not triggered)
      expect(typeof record.cacheCreationTokens).toBe("number");
      expect(typeof record.cacheReadTokens).toBe("number");
      expect(record.cacheCreationTokens).toBeGreaterThanOrEqual(0);
      expect(record.cacheReadTokens).toBeGreaterThanOrEqual(0);
    });

    it("handles missing cache tokens gracefully", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Simple response")
        .withState({ scenario: "direct" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();

      // Even if provider doesn't return cache tokens, we should have valid 0 values
      for (const record of result.tracking!.usage) {
        expect(record.cacheCreationTokens).toBeGreaterThanOrEqual(0);
        expect(record.cacheReadTokens).toBeGreaterThanOrEqual(0);
        // Should not be undefined or null
        expect(record.cacheCreationTokens).not.toBeUndefined();
        expect(record.cacheReadTokens).not.toBeUndefined();
      }
    });

    it("includes reasoning tokens field", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Test reasoning tokens")
        .withState({ scenario: "direct" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();

      for (const record of result.tracking!.usage) {
        // Reasoning tokens should be a number (may be 0 for non-reasoning models)
        expect(typeof record.reasoningTokens).toBe("number");
        expect(record.reasoningTokens).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // =====================================================
  // Cross-Provider Verification
  // =====================================================
  // Tests that usage tracking works correctly across different LLM providers.
  // This validates that our callback handler correctly extracts usage from
  // both Anthropic and OpenAI response formats.
  describe("cross-provider verification", () => {
    it("Anthropic (tier 3): tracked usage matches AIMessage.usage_metadata exactly", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Say 'hello from Anthropic'")
        .withState({ scenario: "direct", maxTier: 3 })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.tracking).toBeDefined();
      expect(result.tracking!.usage.length).toBeGreaterThan(0);
      expect(result.tracking!.messagesProduced.length).toBe(result.tracking!.usage.length);

      // Verify each tracked record matches its AIMessage exactly
      for (const record of result.tracking!.usage) {
        const message = result.tracking!.messagesProduced.find((m) => m.id === record.messageId);
        expect(message).toBeDefined();

        const messageUsage = (message as any).usage_metadata;
        expect(record.inputTokens).toBe(messageUsage.input_tokens);
        expect(record.outputTokens).toBe(messageUsage.output_tokens);
        expect(record.reasoningTokens).toBe(messageUsage.output_token_details?.reasoning || 0);

        // Verify cache tokens (Anthropic format)
        const expectedCacheCreation =
          messageUsage.cache_creation_input_tokens ||
          messageUsage.input_token_details?.cache_creation ||
          0;
        const expectedCacheRead =
          messageUsage.cache_read_input_tokens ||
          messageUsage.input_token_details?.cache_read ||
          0;
        expect(record.cacheCreationTokens).toBe(expectedCacheCreation);
        expect(record.cacheReadTokens).toBe(expectedCacheRead);

        // Model should be captured
        expect(record.model).toContain("claude");
      }
    });

    it("OpenAI (tier 4): tracked usage matches AIMessage.usage_metadata exactly", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Say 'hello from OpenAI'")
        .withState({ scenario: "direct", maxTier: 4 })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.tracking).toBeDefined();
      expect(result.tracking!.usage.length).toBeGreaterThan(0);
      expect(result.tracking!.messagesProduced.length).toBe(result.tracking!.usage.length);

      // Verify each tracked record matches its AIMessage exactly
      for (const record of result.tracking!.usage) {
        const message = result.tracking!.messagesProduced.find((m) => m.id === record.messageId);
        expect(message).toBeDefined();

        const messageUsage = (message as any).usage_metadata;
        expect(record.inputTokens).toBe(messageUsage.input_tokens);
        expect(record.outputTokens).toBe(messageUsage.output_tokens);

        // OpenAI may include reasoning tokens (for o1/o3 models) or not
        const expectedReasoning = messageUsage.output_token_details?.reasoning || 0;
        expect(record.reasoningTokens).toBe(expectedReasoning);

        // OpenAI cache tokens (may be in different format)
        const expectedCacheCreation =
          messageUsage.cache_creation_input_tokens ||
          messageUsage.input_token_details?.cache_creation ||
          0;
        const expectedCacheRead =
          messageUsage.cache_read_input_tokens ||
          messageUsage.input_token_details?.cache_read ||
          0;
        expect(record.cacheCreationTokens).toBe(expectedCacheCreation);
        expect(record.cacheReadTokens).toBe(expectedCacheRead);

        // Model should be captured
        expect(record.model).toContain("gpt");
      }
    });

    it("both providers: totals match when summed across all records", async () => {
      // Test with Anthropic
      const anthropicResult = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Count to three")
        .withState({ scenario: "direct", maxTier: 3 })
        .withTracking()
        .execute();

      expect(anthropicResult.error).toBeUndefined();

      // Sum tracked totals
      const anthropicTrackedInput = anthropicResult.tracking!.usage.reduce(
        (sum, r) => sum + r.inputTokens,
        0
      );
      const anthropicTrackedOutput = anthropicResult.tracking!.usage.reduce(
        (sum, r) => sum + r.outputTokens,
        0
      );

      // Sum from AIMessage.usage_metadata directly
      const anthropicExpectedInput = anthropicResult.tracking!.messagesProduced.reduce(
        (sum, m) => sum + ((m as any).usage_metadata?.input_tokens || 0),
        0
      );
      const anthropicExpectedOutput = anthropicResult.tracking!.messagesProduced.reduce(
        (sum, m) => sum + ((m as any).usage_metadata?.output_tokens || 0),
        0
      );

      expect(anthropicTrackedInput).toBe(anthropicExpectedInput);
      expect(anthropicTrackedOutput).toBe(anthropicExpectedOutput);

      // Test with OpenAI
      const openaiResult = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Count to three")
        .withState({ scenario: "direct", maxTier: 4 })
        .withTracking()
        .execute();

      expect(openaiResult.error).toBeUndefined();

      const openaiTrackedInput = openaiResult.tracking!.usage.reduce(
        (sum, r) => sum + r.inputTokens,
        0
      );
      const openaiTrackedOutput = openaiResult.tracking!.usage.reduce(
        (sum, r) => sum + r.outputTokens,
        0
      );

      const openaiExpectedInput = openaiResult.tracking!.messagesProduced.reduce(
        (sum, m) => sum + ((m as any).usage_metadata?.input_tokens || 0),
        0
      );
      const openaiExpectedOutput = openaiResult.tracking!.messagesProduced.reduce(
        (sum, m) => sum + ((m as any).usage_metadata?.output_tokens || 0),
        0
      );

      expect(openaiTrackedInput).toBe(openaiExpectedInput);
      expect(openaiTrackedOutput).toBe(openaiExpectedOutput);
    });
  });
});
