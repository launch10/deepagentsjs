/**
 * Graph wrapper for credit exhaustion detection.
 *
 * This wrapper uses the subgraph pattern to add credit exhaustion detection
 * after any graph completes. The inner graph runs as a subgraph, and when it
 * reaches END, control flows to the creditExhaustion node.
 *
 * Usage:
 * ```typescript
 * export const myGraph = withCreditExhaustion(
 *   new StateGraph(MyAnnotation)
 *     .addNode("nodeA", nodeA)
 *     .addNode("nodeB", nodeB)
 *     .addEdge(START, "nodeA")
 *     .addEdge("nodeA", "nodeB")
 *     .addEdge("nodeB", END),
 *   MyAnnotation  // Pass annotation so outer graph preserves all state
 * );
 *
 * // Later, compile with options
 * const compiled = myGraph.compile({ name: "myGraph", ...graphParams });
 * ```
 *
 * The inner graph's END becomes "exit subgraph" - state flows through to
 * creditExhaustion, then to the outer graph's END. All state is preserved
 * because the outer graph uses the same annotation as the inner graph.
 */
import { START, END, StateGraph } from "@langchain/langgraph";
import { calculateCreditStatusNode } from "@nodes";

/**
 * Wraps a graph with credit exhaustion detection using the subgraph pattern.
 *
 * Flow: START -> innerGraph (subgraph) -> creditExhaustion -> END
 *
 * @param innerGraph - The StateGraph to wrap (must have edges to END)
 * @param annotation - The annotation type (must extend BaseAnnotation for creditStatus)
 * @returns A new StateGraph with credit exhaustion detection
 */
export function withCreditExhaustion<
  A extends ReturnType<typeof import("@langchain/langgraph").Annotation.Root<any>>,
  T extends StateGraph<any, any, any, any, any, any, any, any>,
>(innerGraph: T, annotation: A): T {
  // The outer graph uses the same annotation as the inner graph,
  // so all state flows through correctly to the frontend.
  // calculateCreditStatusNode only needs CoreGraphState fields (via BaseAnnotation).
  // Compile inner graph without checkpointer - outer graph's compile() handles that.
  return new StateGraph(annotation)
    .addNode("run", innerGraph.compile() as any)
    .addNode("creditExhaustion", calculateCreditStatusNode)
    .addEdge(START, "run")
    .addEdge("run", "creditExhaustion")
    .addEdge("creditExhaustion", END) as unknown as T;
}
