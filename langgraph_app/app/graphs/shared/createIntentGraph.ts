/**
 * Intent Graph Factory
 *
 * Creates a graph that routes based on intent type.
 * Pattern: START → routeByIntent → [subgraph] → clearIntent → END
 *
 * Usage:
 * ```typescript
 * const websiteGraph = createIntentGraph<WebsiteIntent["type"]>({
 *   annotation: WebsiteAnnotation,
 *   intents: {
 *     change_theme: themeHandlerSubgraph,
 *     improve_copy: improveCopySubgraph,
 *     default: websiteBuilderSubgraph,
 *   },
 * });
 * ```
 */
import { StateGraph, START, END, type AnnotationRoot } from "@langchain/langgraph";
import { withCreditExhaustion } from "./withCreditTracking";

interface CreateIntentGraphOptions<TAnnotation, TIntentType extends string> {
  /** The annotation defining the graph state (must have intent field) */
  annotation: TAnnotation;
  /** Map of intent types to compiled subgraphs. Must include "default". */
  intents: {
    default: any; // Required - runs when no intent matches
  } & {
    [K in TIntentType]?: any; // Optional handlers for each valid intent type
  };
}

/**
 * Creates an intent-routed graph.
 *
 * @typeParam TIntentType - Union of valid intent type strings (e.g., WebsiteIntent["type"])
 *
 * - Routes by `state.intent?.type`
 * - Falls back to "default" when no intent or unhandled intent type
 * - Clears intent after any subgraph completes
 * - Wrapped with credit exhaustion tracking
 */
export function createIntentGraph<TIntentType extends string = string>() {
  return function <TAnnotation extends AnnotationRoot<any>>({
    annotation,
    intents,
  }: CreateIntentGraphOptions<TAnnotation, TIntentType>) {
    if (!intents.default) {
      throw new Error("createIntentGraph requires a 'default' intent handler");
    }

    const intentTypes = Object.keys(intents);

    // Router function - checks intent type and returns matching node name
    const routeByIntent = (state: any): string => {
      const type = state.intent?.type;
      return type && intents[type as keyof typeof intents] ? type : "default";
    };

    // Clear intent after flow completes
    const clearIntent = (state: any) => {
      return {
        intent: null,
      };
    };

    // Build the graph dynamically
    // Using 'any' casts because Langgraph's types don't support dynamic node names
    let graph: any = new StateGraph(annotation);

    // Add each intent as a node
    for (const intentType of intentTypes) {
      graph = graph.addNode(intentType, intents[intentType as keyof typeof intents]);
    }

    // Add clearIntent node
    graph = graph.addNode("clearIntent", clearIntent);

    // Route from START based on intent type
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
  };
}
