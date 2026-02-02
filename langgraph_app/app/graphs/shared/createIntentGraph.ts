/**
 * Intent Graph Factory
 *
 * Creates a graph that routes based on intent type.
 * Pattern: routeIntent → [subgraph] → clearIntent → END
 *
 * Usage:
 * ```typescript
 * const websiteGraph = createIntentGraph({
 *   annotation: WebsiteAnnotation,
 *   intents: {
 *     change_theme: themeHandlerSubgraph,
 *     improve_copy: improveCopySubgraph,
 *     default: websiteBuilderSubgraph,
 *   },
 * });
 * ```
 */
import { StateGraph, START, END } from "@langchain/langgraph";
import { withCreditExhaustion } from "./withCreditTracking";

interface CreateIntentGraphOptions<TAnnotation> {
  /** The annotation defining the graph state (must have intent field) */
  annotation: TAnnotation;
  /** Map of intent types to compiled subgraphs. Must include "default". */
  intents: {
    default: any; // Required - runs when no intent matches
    [intentType: string]: any;
  };
}

/**
 * Creates an intent-routed graph.
 *
 * - Routes by `state.intent?.type`
 * - Falls back to "default" when no intent
 * - Clears intent after any subgraph completes
 * - Wrapped with credit exhaustion tracking
 */
export function createIntentGraph<
  TAnnotation extends ReturnType<typeof import("@langchain/langgraph").Annotation.Root<any>>,
>({ annotation, intents }: CreateIntentGraphOptions<TAnnotation>) {
  if (!intents.default) {
    throw new Error("createIntentGraph requires a 'default' intent handler");
  }

  const intentTypes = Object.keys(intents);

  // Router function
  const routeByIntent = (state: any): string => {
    const intentType = state.intent?.type;
    if (intentType && intents[intentType]) {
      return intentType;
    }
    return "default";
  };

  // Clear intent after flow completes
  const clearIntent = () => ({
    intent: undefined,
  });

  // Build the graph dynamically
  // Using 'any' casts because Langgraph's types don't support dynamic node names
  let graph: any = new StateGraph(annotation);

  // Add each intent as a node
  for (const intentType of intentTypes) {
    graph = graph.addNode(intentType, intents[intentType]);
  }

  // Add clearIntent node
  graph = graph.addNode("clearIntent", clearIntent);

  // Route from START
  const routeMap: Record<string, string> = {};
  for (const intentType of intentTypes) {
    routeMap[intentType] = intentType;
  }
  graph = graph.addConditionalEdges(START, routeByIntent, routeMap);

  // All intents → clearIntent → END
  for (const intentType of intentTypes) {
    graph = graph.addEdge(intentType, "clearIntent");
  }
  graph = graph.addEdge("clearIntent", END);

  // Wrap with credit tracking
  return withCreditExhaustion(graph, annotation);
}
