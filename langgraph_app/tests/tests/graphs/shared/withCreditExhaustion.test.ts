import { describe, it, expect, vi, beforeEach } from "vitest";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { withCreditExhaustion } from "@graphs";
import type { CreditStatus } from "@types";

// Mock only calculateCreditStatusNode — preserve all other exports
vi.mock("@nodes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nodes")>();
  return {
    ...actual,
    calculateCreditStatusNode: vi.fn().mockResolvedValue({ creditStatus: { justExhausted: false } }),
  };
});

import { calculateCreditStatusNode } from "@nodes";

/**
 * Tests for the withCreditExhaustion graph wrapper.
 *
 * These tests verify that the wrapper correctly uses the subgraph pattern
 * to add credit exhaustion detection after any graph completes.
 */
describe("withCreditExhaustion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test annotation that includes creditStatus (like real graphs extending BaseAnnotation)
  const TestAnnotation = Annotation.Root({
    value: Annotation<number>({
      default: () => 0,
      reducer: (_, next) => next ?? _,
    }),
    creditStatus: Annotation<CreditStatus | undefined>({
      default: () => undefined,
      reducer: (_, next) => next ?? _,
    }),
  });

  describe("subgraph wrapper pattern", () => {
    it("wraps graph as subgraph with creditExhaustion node", () => {
      const baseGraph = new StateGraph(TestAnnotation)
        .addNode("increment", (state) => ({ value: state.value + 1 }))
        .addEdge(START, "increment")
        .addEdge("increment", END);

      const wrappedGraph = withCreditExhaustion(baseGraph, TestAnnotation);

      // Compile and check the outer graph structure
      const compiled = wrappedGraph.compile();
      const nodes = compiled.getGraph().nodes;

      // The outer graph should have "run" (subgraph) and "creditExhaustion" nodes
      expect(Object.keys(nodes)).toContain("run");
      expect(Object.keys(nodes)).toContain("creditExhaustion");
    });

    it("executes inner graph then creditExhaustion", async () => {
      const baseGraph = new StateGraph(TestAnnotation)
        .addNode("increment", (state) => ({ value: state.value + 1 }))
        .addEdge(START, "increment")
        .addEdge("increment", END);

      const wrappedGraph = withCreditExhaustion(baseGraph, TestAnnotation);
      const compiled = wrappedGraph.compile();

      const result = await compiled.invoke({ value: 0 });

      // Both inner graph and credit status should have run
      expect(result.value).toBe(1);
      expect(calculateCreditStatusNode).toHaveBeenCalled();
    });

    it("works with multi-node linear graphs", async () => {
      const baseGraph = new StateGraph(TestAnnotation)
        .addNode("double", (state) => ({ value: state.value * 2 }))
        .addNode("addTen", (state) => ({ value: state.value + 10 }))
        .addEdge(START, "double")
        .addEdge("double", "addTen")
        .addEdge("addTen", END);

      const wrappedGraph = withCreditExhaustion(baseGraph, TestAnnotation);
      const compiled = wrappedGraph.compile();

      const result = await compiled.invoke({ value: 5 });

      expect(result.value).toBe(20); // (5 * 2) + 10 = 20
      expect(calculateCreditStatusNode).toHaveBeenCalled();
    });

    it("works with conditional edges", async () => {
      const baseGraph = new StateGraph(TestAnnotation)
        .addNode("check", (state) => state)
        .addNode("increment", (state) => ({ value: state.value + 1 }))
        .addEdge(START, "check")
        .addConditionalEdges("check", (state) => (state.value < 5 ? "increment" : "end"), {
          increment: "increment",
          end: END,
        })
        .addEdge("increment", END);

      const wrappedGraph = withCreditExhaustion(baseGraph, TestAnnotation);
      const compiled = wrappedGraph.compile();

      // Test path that goes through increment
      const result1 = await compiled.invoke({ value: 0 });
      expect(result1.value).toBe(1);
      expect(calculateCreditStatusNode).toHaveBeenCalled();

      vi.clearAllMocks();

      // Test path that goes directly to end
      const result2 = await compiled.invoke({ value: 10 });
      expect(result2.value).toBe(10);
      expect(calculateCreditStatusNode).toHaveBeenCalled();
    });
  });

  describe("state merging", () => {
    it("merges creditStatus into graph state", async () => {
      vi.mocked(calculateCreditStatusNode).mockResolvedValue({
        creditStatus: {
          justExhausted: true,
          estimatedRemainingMillicredits: 0,
          preRunMillicredits: 1000,
          estimatedCostMillicredits: 1000,
        },
      });

      const baseGraph = new StateGraph(TestAnnotation)
        .addNode("noop", (state) => state)
        .addEdge(START, "noop")
        .addEdge("noop", END);

      const wrappedGraph = withCreditExhaustion(baseGraph, TestAnnotation);
      const compiled = wrappedGraph.compile();

      const result = await compiled.invoke({ value: 42 });

      expect(result.creditStatus?.justExhausted).toBe(true);
      expect(result.creditStatus?.estimatedRemainingMillicredits).toBe(0);
      expect(result.creditStatus?.preRunMillicredits).toBe(1000);
      expect(result.creditStatus?.estimatedCostMillicredits).toBe(1000);
    });

    it("preserves inner graph state through wrapper", async () => {
      const baseGraph = new StateGraph(TestAnnotation)
        .addNode("setTo100", () => ({ value: 100 }))
        .addEdge(START, "setTo100")
        .addEdge("setTo100", END);

      const wrappedGraph = withCreditExhaustion(baseGraph, TestAnnotation);
      const compiled = wrappedGraph.compile();

      const result = await compiled.invoke({ value: 0 });

      expect(result.value).toBe(100);
    });
  });
});
