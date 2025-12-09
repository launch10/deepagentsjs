import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { type CoreGraphState } from "@state";
import { db, eq, and, projects as projectsTable, chats as chatsTable } from "@db";
import { generateUUID, type ConsoleError } from "@types";
import { isGraphInterrupt } from "@langchain/langgraph";
import { runScenario } from "@services";
import { interruptContext } from "app/core/node/middleware";
import { CompiledStateGraph } from "@langchain/langgraph";
import { graphParams } from "@core";
import { vi } from "vitest";
export interface NodeTestResult<TState extends CoreGraphState> {
  state: TState;
  messages: BaseMessage[];
  error?: Error;
  promptSpy?: Map<string, string[]>;
  serviceSpy?: Map<string, any[]>;
}

type CompiledGraph = CompiledStateGraph<any, any, any, any, any, any, any, any, any>;
export interface GraphTestConfig {
  usePolly?: boolean;
}

/**
 * GraphTestBuilder provides a fluent API for testing individual nodes in a LangGraph
 * with automatic Polly HTTP recording/replay for LLM calls.
 *
 * Key Features:
 * - Tests through the main router graph for full execution flow visibility
 * - Can interrupt at any node, including nodes within subgraphs
 * - Uses LangGraph's native interrupt mechanism
 *
 * How it works:
 * 1. Set TEST_INTERRUPT_NODE environment variable to the target node name
 * 2. Nodes using NodeMiddleware will check this and interrupt after execution
 * 3. The interrupt includes the full state at that point
 * 4. The test captures and returns this state for assertions
 *
 * @example
 * const result = await testGraph()
 *   .withGraph(routerGraph)
 *   .withPrompt("Create a website about dogs")
 *   .stopAfter("nameProject")  // Can be any node, even in subgraphs
 *   .execute();
 */
export class GraphTestBuilder<TGraphState extends CoreGraphState> {
  private prompt!: string;
  private targetNode!: string;
  private initialState: any = {};
  private config: Partial<LangGraphRunnableConfig> = {};
  private graph: CompiledGraph | undefined;
  private websiteName?: string; // Store project name for deferred loading
  private scenario?: string;
  private threadId?: string;
  private chatType?: string;

  constructor() {
    // Initialize with an in-memory checkpointer for tests
    this.threadId = generateUUID();
    this.config = {
      configurable: {
        thread_id: this.threadId,
      },
    };

    this.initialState = {
      jwt: "test-jwt",
      accountId: 1,
      error: undefined,
      messages: [] as BaseMessage[],
      projectId: undefined,
      projectName: undefined,
    };
  }

  /**
   * Set the initial user prompt for the test
   */
  withPrompt(prompt: string): GraphTestBuilder<TGraphState> {
    this.prompt = prompt;
    return this;
  }

  /**
   * Set the graph instance to test
   */
  withGraph(graph: CompiledGraph): GraphTestBuilder<TGraphState> {
    this.graph = graph;
    return this;
  }

  withScenario(scenario: string): GraphTestBuilder<TGraphState> {
    this.scenario = scenario;
    return this;
  }

  /**
   * Set additional initial state
   */
  withState(state: Partial<TGraphState>): GraphTestBuilder<TGraphState> {
    this.initialState = { ...this.initialState, ...state };
    return this;
  }

  /**
   * Set additional config options
   */
  withConfig(config: Partial<LangGraphRunnableConfig>): GraphTestBuilder<TGraphState> {
    this.config = { ...this.config, ...config };
    return this;
  }

  /**
   * Resume from a project's saved thread state (deferred until execution)
   * @param websiteName The name of the website to resume from
   */
  withWebsite(websiteName: string): GraphTestBuilder<TGraphState> {
    this.websiteName = websiteName;
    // Clear any existing thread_id as it will be loaded from the project
    delete this.config.configurable?.thread_id;
    return this;
  }

  /**
   * Set the chat type to test (e.g. helps us resume a brainstorm or website chat)
   */
  withChatType(chatType: "brainstorm" | "website" | "ads"): GraphTestBuilder<TGraphState> {
    this.chatType = chatType;
    return this;
  }

  /**
   * Load project thread ID if a project name was specified
   */
  private async loadThread(): Promise<void> {
    if (!this.websiteName) {
      return;
    }

    const project = (
      await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.name, this.websiteName))
        .execute()
    )[0];

    if (!project) {
      throw new Error(`Project "${this.websiteName}" not found`);
    }

    if (!this.chatType) {
      throw new Error(
        "Chat type is required when loading a project thread. Call .withChatType() to set it."
      );
    }

    const chat = (
      await db
        .select()
        .from(chatsTable)
        .where(and(eq(chatsTable.projectId, project.id), eq(chatsTable.chatType, this.chatType)))
        .execute()
    )[0];

    if (!chat?.threadId) {
      throw new Error(`Project "${this.websiteName}" not found or has no thread_id`);
    }

    // Update config with the chat's thread ID
    if (!this.config.configurable) {
      this.config.configurable = {};
    }
    this.config.configurable.thread_id = chat.threadId;
  }

  /**
   * Specify which node to stop after (alias for testNode)
   */
  stopAfter(nodeName: string): GraphTestBuilder<TGraphState> {
    this.targetNode = nodeName;
    return this;
  }

  /**
   * Specify which node to test (alias for stopAfter)
   */
  testNode(nodeName: string): GraphTestBuilder<TGraphState> {
    return this.stopAfter(nodeName);
  }

  /**
   * Execute the graph up to the target node and return the result
   */
  async execute(): Promise<NodeTestResult<TGraphState>> {
    if (!this.graph) {
      throw new Error("Graph is required. Use .withGraph() to set it.");
    }

    // Load thread ID if website specified
    await this.loadThread();

    let consoleErrors: ConsoleError[] = [];
    if (this.scenario && this.websiteName) {
      const scenarioRunner = await runScenario({
        website: this.websiteName,
        scenario: this.scenario,
      });
      await scenarioRunner.run();
      consoleErrors = scenarioRunner.getConsoleErrors();
    }

    const initialStateMessages = this.initialState.messages || [];
    const userMessage = this.prompt ? new HumanMessage(this.prompt) : undefined;

    const baseState = {
      ...this.initialState,
      messages: userMessage ? [...initialStateMessages, userMessage] : initialStateMessages,
    };

    const initialState: TGraphState = (
      this.graph.channels?.consoleErrors ? { ...baseState, consoleErrors } : baseState
    ) as TGraphState;

    try {
      const testGraph = this.graph;

      const result = this.targetNode
        ? await interruptContext.run({ nodeName: this.targetNode }, async () => {
            return await testGraph.invoke(initialState, this.config);
          })
        : await testGraph.invoke(initialState, this.config);

      if (result && result.__interrupt__) {
        // The state at the time of interrupt is the result minus the __interrupt__ key
        const { __interrupt__, ...stateAtInterrupt } = result;
        const state = __interrupt__[0].value.state;
        return {
          state,
          messages: state.messages || [],
          error: undefined,
        };
      }

      return {
        state: result,
        messages: result.messages || [],
        error: result.error,
      };
    } catch (error) {
      // Check if this is a GraphInterrupt - this is expected for test interrupts
      if (isGraphInterrupt(error)) {
        // Extract the interrupt value which should contain our state
        const interruptValue = error.interrupts?.[0]?.value;
        if (interruptValue && interruptValue.state) {
          return {
            state: interruptValue.state,
            messages: interruptValue.state.messages || [],
            error: undefined,
          };
        }
        // Fallback: use the initial state with updates from the error
        return {
          state: { ...initialState, ...(interruptValue || {}) },
          messages: initialState.messages || [],
          error: undefined,
        };
      }

      // Regular error - return as error
      return {
        state: initialState,
        messages: initialState.messages || [],
        error: error as Error,
      };
    }
  }
}

/**
 * Factory function to create a new GraphTestBuilder
 */
export function testGraph<TGraphState extends CoreGraphState>(): GraphTestBuilder<TGraphState> {
  return new GraphTestBuilder<TGraphState>();
}

/**
 * Helper to quickly test a node with minimal setup
 */
export async function testNode<TGraphState extends CoreGraphState>(
  graph: any,
  nodeName: string,
  prompt: string,
  options?: {
    state?: Partial<TGraphState>;
  }
): Promise<NodeTestResult<TGraphState>> {
  const builder = new GraphTestBuilder<TGraphState>()
    .withGraph(graph)
    .withPrompt(prompt)
    .stopAfter(nodeName);

  if (options?.state) {
    builder.withState(options.state);
  }

  return builder.execute();
}
