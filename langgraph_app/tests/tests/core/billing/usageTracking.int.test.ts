import { describe, it, expect } from "vitest";
import { testGraph } from "@support";
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
  // Compile the graph once for all integration tests
  const compiledGraph = usageTrackingTestGraph.compile({
    checkpointer: new MemorySaver(),
  });

  describe("direct model.invoke()", () => {
    it("fires handleLLMEnd and captures usage", async () => {
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
      expect(record.inputTokens).toBeGreaterThan(0);
      expect(record.outputTokens).toBeGreaterThan(0);
    });

    it("captures correct input_tokens and output_tokens", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Respond with exactly: OK")
        .withState({ scenario: "direct" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      const record = result.tracking!.usage[0]!;

      // Should have reasonable token counts
      expect(record.inputTokens).toBeGreaterThan(0);
      expect(record.outputTokens).toBeGreaterThan(0);
      // Input should be larger than output for this short response
      expect(record.inputTokens).toBeGreaterThanOrEqual(record.outputTokens);
    });

    it("captures messages produced for traces", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Say 'traced response'")
        .withState({ scenario: "direct" })
        .withTracking()
        .execute();

      expect(result.tracking!.messagesProduced.length).toBeGreaterThan(0);
    });
  });

  describe("agent tool loops", () => {
    it("fires handleLLMEnd for initial agent reasoning call", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Use the echo tool once to say 'test'")
        .withState({ scenario: "agent", iterationCount: 1 })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      // Agent should have at least 2 LLM calls: initial reasoning + after tool result
      expect(result.tracking!.usage.length).toBeGreaterThanOrEqual(2);
    });

    it("fires handleLLMEnd for EACH iteration in multi-turn loop", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Use the echo tool 2 times")
        .withState({ scenario: "agent", iterationCount: 2 })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      // Should have at least 2 LLM calls for multi-turn (LLM might batch tool calls)
      // The important thing is that we're capturing ALL LLM calls that happen
      expect(result.tracking!.usage.length).toBeGreaterThanOrEqual(2);
    });

    it("accumulates all records from agent execution", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Use the echo tool once")
        .withState({ scenario: "agent", iterationCount: 1 })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      // All records should be accumulated
      const totalInputTokens = result.tracking!.usage.reduce(
        (sum, r) => sum + r.inputTokens,
        0
      );
      const totalOutputTokens = result.tracking!.usage.reduce(
        (sum, r) => sum + r.outputTokens,
        0
      );

      expect(totalInputTokens).toBeGreaterThan(0);
      expect(totalOutputTokens).toBeGreaterThan(0);
    });
  });

  describe("tools calling getLLM() internally", () => {
    it("fires handleLLMEnd for tool-internal LLM call", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Summarize some text")
        .withState({ scenario: "tool-llm" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      // Should have at least 1 record from the tool's internal LLM call
      expect(result.tracking!.usage.length).toBeGreaterThan(0);
    });

    it("context survives from graph execution into tool callback", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Summarize text")
        .withState({ scenario: "tool-llm" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();
      // The tool sets toolSawContext=true if it could see the usage context
      expect(result.state.toolSawContext).toBe(true);
    });
  });

  describe("middleware that calls LLMs", () => {
    it.only("tracks both agent LLM call and middleware LLM call", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Tell me a joke")
        .withState({ scenario: "middleware" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();

      // Middleware scenario uses createAgent with explainJokeMiddleware:
      // - 1 LLM call from the agent (tell a joke)
      // - 1 LLM call from the middleware (explain why it's funny)
      expect(result.tracking!.usage.length).toBeGreaterThanOrEqual(2);

      // Verify we captured messages from both LLM calls
      expect(result.tracking!.messagesProduced.length).toBeGreaterThanOrEqual(2);

      console.log(result.tracking);
      // Each usage record should have valid token counts
      for (const record of result.tracking!.usage) {
        expect(record.model).toBeDefined();
        expect(record.inputTokens).toBeGreaterThan(0);
        expect(record.outputTokens).toBeGreaterThan(0);
      }
    });

    it("tracks middleware LLM call with correct token attribution", async () => {
      const result = await testGraph<UsageTrackingTestState>()
        .withGraph(compiledGraph)
        .withPrompt("Tell me something funny")
        .withState({ scenario: "middleware" })
        .withTracking()
        .execute();

      expect(result.error).toBeUndefined();

      // Both the agent's LLM call and the middleware's LLM call should be tracked
      const usageRecords = result.tracking!.usage;
      expect(usageRecords.length).toBeGreaterThanOrEqual(2);

      // Calculate total tokens across all calls
      const totalInputTokens = usageRecords.reduce((sum, r) => sum + r.inputTokens, 0);
      const totalOutputTokens = usageRecords.reduce((sum, r) => sum + r.outputTokens, 0);

      // Both LLM calls should contribute to the total
      expect(totalInputTokens).toBeGreaterThan(usageRecords[0]!.inputTokens);
      expect(totalOutputTokens).toBeGreaterThan(usageRecords[0]!.outputTokens);
    });
  });
});
