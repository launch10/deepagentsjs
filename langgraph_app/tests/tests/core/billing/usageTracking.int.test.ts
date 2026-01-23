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
});
