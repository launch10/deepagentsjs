import { describe, it, expect } from "vitest";
import * as graphs from "@graphs";

/**
 * Static validation test to ensure all exported graphs are wrapped with withCreditExhaustion.
 *
 * This test prevents engineers from accidentally deploying a graph without credit tracking.
 * Every public graph API must include credit exhaustion detection to:
 * 1. Track LLM usage costs for billing
 * 2. Notify users when their credits are running low
 * 3. Prevent unexpected charges
 *
 * If this test fails, wrap your graph with withCreditExhaustion:
 * ```typescript
 * export const myGraph = withCreditExhaustion(
 *   new StateGraph(MyAnnotation)
 *     .addNode(...)
 *     ...,
 *   MyAnnotation
 * );
 * ```
 */
describe("All graphs credit tracking validation", () => {
  /**
   * List of all graphs that must be wrapped with withCreditExhaustion.
   * Add new graphs here when they are created.
   */
  const REQUIRED_GRAPHS = [
    "brainstormGraph",
    "adsGraph",
    "websiteGraph",
    "deployGraph",
    "insightsGraph",
  ];

  it("exports all required graphs", () => {
    const exportedGraphs = Object.keys(graphs);

    for (const graphName of REQUIRED_GRAPHS) {
      expect(exportedGraphs).toContain(graphName);
    }
  });

  /**
   * Test that each graph has the "run" and "creditExhaustion" nodes
   * that are added by withCreditExhaustion wrapper.
   *
   * The wrapper creates an outer graph with:
   * - "run" node: the inner graph as a subgraph
   * - "creditExhaustion" node: calculates credit status
   */
  describe("credit wrapping validation", () => {
    for (const graphName of REQUIRED_GRAPHS) {
      it(`${graphName} is wrapped with withCreditExhaustion`, () => {
        const graph = (graphs as Record<string, unknown>)[graphName];
        expect(graph).toBeDefined();

        // Compile the graph and check its structure
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const compiled = (graph as any).compile();
        const nodes = compiled.getGraph().nodes;
        const nodeNames = Object.keys(nodes);

        // Graphs wrapped with withCreditExhaustion have "run" and "creditExhaustion" nodes
        const hasRunNode = nodeNames.includes("run");
        const hasCreditExhaustionNode = nodeNames.includes("creditExhaustion");

        expect(
          hasRunNode && hasCreditExhaustionNode,
          `${graphName} must be wrapped with withCreditExhaustion.\n` +
            `Expected nodes "run" and "creditExhaustion", but found: [${nodeNames.join(", ")}]\n\n` +
            `To fix, wrap your graph:\n` +
            `export const ${graphName} = withCreditExhaustion(\n` +
            `  new StateGraph(...)\n` +
            `    .addNode(...)\n` +
            `    ...,\n` +
            `  YourAnnotation\n` +
            `);`
        ).toBe(true);
      });
    }
  });
});
