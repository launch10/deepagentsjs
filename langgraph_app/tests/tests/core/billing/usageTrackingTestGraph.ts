/**
 * Test graph for validating usage tracking across all LLM call patterns.
 *
 * This graph exercises:
 * - Direct model.invoke() calls
 * - Agent tool loops (multiple iterations)
 * - Tools that call getLLM() internally
 * - Middleware that calls LLM
 */
import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createAgent, createMiddleware } from "langchain";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLLM, getUsageContext, NodeMiddleware } from "@core";
import { BaseAnnotation } from "@annotation";
import type { CoreGraphState } from "@state";

/**
 * Test scenarios we want to validate:
 * - direct: Simple getLLM().invoke()
 * - agent: Multi-turn agent with tool loops
 * - tool-llm: Tool that internally calls getLLM()
 * - middleware: Node with middleware that calls LLM
 * - error-after-success: LLM call succeeds, then node throws
 * - subgraph: Parent graph invokes child subgraph with LLM calls
 */
export type UsageTrackingScenario =
  | "direct"
  | "agent"
  | "tool-llm"
  | "middleware"
  | "error-after-success"
  | "subgraph";

/**
 * Extended state for usage tracking tests
 */
export const UsageTrackingTestAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,
  scenario: Annotation<UsageTrackingScenario>({
    default: () => "direct" as UsageTrackingScenario,
    reducer: (current, next) => next,
  }),
  iterationCount: Annotation<number>({
    default: () => 1,
    reducer: (current, next) => next,
  }),
  providerOverride: Annotation<"anthropic" | "openai" | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),
  // Track whether the tool saw the context (for validation)
  toolSawContext: Annotation<boolean | undefined>({
    default: () => undefined,
    reducer: (current, next) => next,
  }),
});

export type UsageTrackingTestState = typeof UsageTrackingTestAnnotation.State;

/**
 * Entry node that routes to the appropriate test scenario
 */
async function entryNode(
  state: UsageTrackingTestState,
  _config: LangGraphRunnableConfig
): Promise<Partial<UsageTrackingTestState>> {
  return { scenario: state.scenario };
}

/**
 * Direct LLM node - calls getLLM().invoke() directly
 * This is the simplest pattern to test.
 */
async function directLLMNode(
  state: UsageTrackingTestState,
  config: LangGraphRunnableConfig
): Promise<Partial<UsageTrackingTestState>> {
  const model = await getLLM({ cost: "paid", speed: "fast" });

  const lastMessage = state.messages.at(-1);
  const prompt = lastMessage?.content || "Say hello";

  const response = await model.invoke([new HumanMessage(String(prompt))], config);

  return {
    messages: [response as AIMessage],
  };
}

/**
 * Simple tool for the agent to use
 */
const echoTool = tool(
  async ({ message }: { message: string }) => {
    return `Echo: ${message}`;
  },
  {
    name: "echo",
    description: "Echoes a message back",
    schema: z.object({
      message: z.string().describe("The message to echo"),
    }),
  }
);

/**
 * Counter tool for agent iteration testing
 */
const counterTool = tool(
  async ({ count }: { count: number }) => {
    return `Current count: ${count}`;
  },
  {
    name: "counter",
    description: "Returns the current count",
    schema: z.object({
      count: z.number().describe("The count to report"),
    }),
  }
);

/**
 * Agent node - uses createReactAgent with tools, loops multiple times
 * Tests that handleLLMEnd fires for each iteration.
 */
async function agentNode(
  state: UsageTrackingTestState,
  config: LangGraphRunnableConfig
): Promise<Partial<UsageTrackingTestState>> {
  const model = await getLLM({ cost: "paid", speed: "fast" });

  const agent = createReactAgent({
    llm: model,
    tools: [echoTool, counterTool],
  });

  const iterations = state.iterationCount || 1;
  const prompt = `Use the echo tool ${iterations} time(s) to say "Hello ${iterations}". Use it exactly that many times.`;

  const result = await agent.invoke(
    {
      messages: [new HumanMessage(prompt)],
    },
    config
  );

  return {
    messages: result.messages,
  };
}

/**
 * Tool that internally calls getLLM() for summarization
 * This pattern is common in complex tools.
 */
const llmSummarizerTool = tool(
  async ({ text }: { text: string }, config) => {
    // Check if we can see the usage context from within the tool
    const context = getUsageContext();

    // Get an LLM and summarize
    const model = await getLLM({ cost: "paid", speed: "fast" });
    const response = await model.invoke(
      [new HumanMessage(`Summarize this in one sentence: ${text}`)],
      config
    );

    return {
      summary: String(response.content),
      sawContext: context !== undefined,
    };
  },
  {
    name: "summarizer",
    description: "Summarizes text using an LLM",
    schema: z.object({
      text: z.string().describe("The text to summarize"),
    }),
  }
);

/**
 * Node that uses a tool with internal LLM call
 */
async function toolWithInternalLLMNode(
  state: UsageTrackingTestState,
  config: LangGraphRunnableConfig
): Promise<Partial<UsageTrackingTestState>> {
  // Invoke the tool directly (not via agent)
  const result = await llmSummarizerTool.invoke(
    { text: "This is a long text about dogs and cats living together in harmony." },
    config
  );

  // The tool returns an object with summary and sawContext
  const toolResult = result as unknown as { summary: string; sawContext: boolean };

  return {
    messages: [new AIMessage(toolResult.summary)],
    toolSawContext: toolResult.sawContext,
  };
}

/**
 * Middleware that makes an LLM call to explain the joke after the agent responds.
 * Tests that usage tracking works for LLM calls made within middleware.
 */
const explainJokeMiddleware = createMiddleware({
  name: "ExplainJokeMiddleware",
  stateSchema: z.object({
    messages: z.array(z.any()),
  }),
  wrapModelCall: async (request, handler) => {
    // Let the agent make its call first
    const response = await handler(request);

    // Then make a second LLM call in the middleware to explain the joke
    const middlewareModel = await getLLM({ cost: "paid", speed: "fast" });
    await middlewareModel.invoke(
      [new HumanMessage(`Explain why this is funny: ${response.content}`)],
      request.runtime
    );

    return response;
  },
});

/**
 * Node that uses an agent with middleware that makes LLM calls.
 * Tests that usage tracking captures both the agent's LLM call and the middleware's LLM call.
 */
async function middlewareLLMNode(
  state: UsageTrackingTestState,
  config: LangGraphRunnableConfig
): Promise<Partial<UsageTrackingTestState>> {
  const model = await getLLM({ cost: "paid", speed: "fast" });

  const agent = await createAgent({
    model,
    tools: [],
    middleware: [explainJokeMiddleware],
  });

  const result = await agent.invoke(
    {
      messages: [new HumanMessage("Tell me a short joke")],
    },
    config
  );

  return {
    messages: result.messages,
  };
}

/**
 * Error scenario: LLM call succeeds, then node throws.
 * Tests that usage is captured even when the graph fails.
 */
async function errorAfterSuccessNode(
  state: UsageTrackingTestState,
  config: LangGraphRunnableConfig
): Promise<Partial<UsageTrackingTestState>> {
  const model = await getLLM({ cost: "paid", speed: "fast" });

  const lastMessage = state.messages.at(-1);
  const prompt = lastMessage?.content || "Say hello";

  // This LLM call should succeed and be tracked
  const response = await model.invoke([new HumanMessage(String(prompt))], config);

  // Store the response in state before throwing
  // This simulates a real scenario where usage is captured but processing fails
  const newMessages = [response as AIMessage];

  // Now throw an error - the usage should still be captured
  throw new Error("Intentional test error after successful LLM call");

  // This return is unreachable but satisfies TypeScript
  return { messages: newMessages };
}

/**
 * Subgraph that makes its own LLM call.
 * Used to test AsyncLocalStorage context preservation across graph boundaries.
 */
const childSubgraph = new StateGraph(UsageTrackingTestAnnotation)
  .addNode("childLLMNode", async (state: UsageTrackingTestState, config: LangGraphRunnableConfig) => {
    // Verify context is available in subgraph
    const context = getUsageContext();

    const model = await getLLM({ cost: "paid", speed: "fast" });
    const response = await model.invoke(
      [new HumanMessage("Say 'I am the child subgraph'")],
      config
    );

    return {
      messages: [response as AIMessage],
      toolSawContext: context !== undefined,
    };
  })
  .addEdge(START, "childLLMNode")
  .addEdge("childLLMNode", END);

const compiledChildSubgraph = childSubgraph.compile();

/**
 * Parent node that invokes a subgraph.
 * Tests that AsyncLocalStorage context is preserved through subgraph invocation.
 */
async function subgraphNode(
  state: UsageTrackingTestState,
  config: LangGraphRunnableConfig
): Promise<Partial<UsageTrackingTestState>> {
  // First make an LLM call in the parent
  const model = await getLLM({ cost: "paid", speed: "fast" });
  const parentResponse = await model.invoke(
    [new HumanMessage("Say 'I am the parent'")],
    config
  );

  // Then invoke the child subgraph
  const subgraphResult = await compiledChildSubgraph.invoke(
    {
      ...state,
      messages: [parentResponse as AIMessage],
    },
    config
  );

  return {
    messages: [...(state.messages || []), parentResponse as AIMessage, ...(subgraphResult.messages || [])],
    toolSawContext: subgraphResult.toolSawContext,
  };
}

/**
 * Router function that directs to the appropriate node based on scenario
 */
function routeByScenario(state: UsageTrackingTestState): string {
  switch (state.scenario) {
    case "direct":
      return "directLLMNode";
    case "agent":
      return "agentNode";
    case "tool-llm":
      return "toolWithInternalLLMNode";
    case "middleware":
      return "middlewareLLMNode";
    case "error-after-success":
      return "errorAfterSuccessNode";
    case "subgraph":
      return "subgraphNode";
    default:
      return "directLLMNode";
  }
}

/**
 * The test graph for usage tracking validation.
 * All nodes are wrapped with NodeMiddleware.use() to enable Polly HTTP recording/replay.
 */
export const usageTrackingTestGraph = new StateGraph(UsageTrackingTestAnnotation)
  .addNode("entryNode", entryNode)
  .addNode("directLLMNode", NodeMiddleware.use({}, directLLMNode))
  .addNode("agentNode", NodeMiddleware.use({}, agentNode))
  .addNode("toolWithInternalLLMNode", NodeMiddleware.use({}, toolWithInternalLLMNode))
  .addNode("middlewareLLMNode", NodeMiddleware.use({}, middlewareLLMNode))
  .addNode("errorAfterSuccessNode", NodeMiddleware.use({}, errorAfterSuccessNode))
  .addNode("subgraphNode", NodeMiddleware.use({}, subgraphNode))

  .addEdge(START, "entryNode")
  .addConditionalEdges("entryNode", routeByScenario, [
    "directLLMNode",
    "agentNode",
    "toolWithInternalLLMNode",
    "middlewareLLMNode",
    "errorAfterSuccessNode",
    "subgraphNode",
  ])
  .addEdge("directLLMNode", END)
  .addEdge("agentNode", END)
  .addEdge("toolWithInternalLLMNode", END)
  .addEdge("middlewareLLMNode", END)
  .addEdge("errorAfterSuccessNode", END)
  .addEdge("subgraphNode", END);
