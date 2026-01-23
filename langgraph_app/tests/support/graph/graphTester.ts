import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { type LangGraphRunnableConfig, Send, CompiledStateGraph } from "@langchain/langgraph";
import { type CoreGraphState } from "@state";
import { db, eq, and, projects as projectsTable, chats as chatsTable } from "@db";
import { generateUUID, type ConsoleError } from "@types";
import { runScenario } from "@services";
import {
  executeWithTrackingAndInterrupt,
  runWithUsageTracking,
  type UsageRecord,
} from "@core";

type NodeFunction<TState extends CoreGraphState> = (
  state: TState,
  config: LangGraphRunnableConfig
) => Promise<Partial<TState> | Send[]>;
/**
 * Tracking result when withTracking() is enabled
 */
export interface TrackingResult {
  usage: UsageRecord[];
  messagesProduced: BaseMessage[];
  systemPrompt?: string;
}

export interface NodeTestResult<TState extends CoreGraphState> {
  state: TState;
  messages: BaseMessage[];
  error?: Error;
  promptSpy?: Map<string, string[]>;
  serviceSpy?: Map<string, any[]>;
  tracking?: TrackingResult;
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
  threadId?: string;
  private chatType?: string;
  private nodeFunction?: NodeFunction<TGraphState>;
  private trackingEnabled = false;
  private trackingResult?: TrackingResult;

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
      threadId: this.threadId,
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
   * Run a single node function in isolation without running the full graph.
   * This is useful for unit testing individual nodes without the overhead
   * of running preceding nodes.
   *
   * @example
   * const result = await testGraph<DeployGraphState>()
   *   .withState({ websiteId: 1, tasks: [] })
   *   .runNode(analyticsNode)
   *   .execute();
   */
  runNode(nodeFn: NodeFunction<TGraphState>): GraphTestBuilder<TGraphState> {
    this.nodeFunction = nodeFn;
    return this;
  }

  /**
   * Enable usage tracking for this test execution.
   * When enabled, all LLM calls will have their usage tracked and
   * the results will be available via getTrackingResult().
   *
   * @example
   * const result = await testGraph()
   *   .withGraph(brainstormGraph)
   *   .withPrompt("Help me brainstorm ideas")
   *   .withTracking()
   *   .execute();
   *
   * expect(result.tracking?.usage.length).toBeGreaterThan(0);
   */
  withTracking(): GraphTestBuilder<TGraphState> {
    this.trackingEnabled = true;
    return this;
  }

  /**
   * Get the tracking result after execution.
   * Only available if withTracking() was called before execute().
   */
  getTrackingResult(): TrackingResult | undefined {
    return this.trackingResult;
  }

  /**
   * Execute the graph up to the target node and return the result.
   * If runNode() was called, executes that single node function in isolation.
   * If withTracking() was called, wraps execution with usage tracking.
   */
  async execute(): Promise<NodeTestResult<TGraphState>> {
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

    // If running a single node, execute it directly
    if (this.nodeFunction) {
      const initialState = { ...baseState, consoleErrors } as TGraphState;
      return this.executeNode(initialState);
    }

    // Otherwise, run the full graph
    if (!this.graph) {
      throw new Error("Graph is required. Use .withGraph() or .runNode() to set it.");
    }

    const initialState: TGraphState = (
      this.graph.channels?.consoleErrors ? { ...baseState, consoleErrors } : baseState
    ) as TGraphState;

    return this.executeGraph(initialState);
  }

  /**
   * Execute a node function, optionally with tracking.
   */
  private async executeNode(initialState: TGraphState): Promise<NodeTestResult<TGraphState>> {
    const doExecute = async () => {
      const nodeResult = await this.nodeFunction!(
        initialState,
        this.config as LangGraphRunnableConfig
      );

      // Handle Send[] return type (routing nodes)
      if (Array.isArray(nodeResult)) {
        return initialState;
      }

      return { ...initialState, ...nodeResult } as TGraphState;
    };

    try {
      if (this.trackingEnabled) {
        const { result, usage, systemPrompt, messagesProduced } = await runWithUsageTracking(
          {
            chatId: initialState.chatId,
            threadId: initialState.threadId,
            graphName: "test-node",
          },
          doExecute
        );

        this.trackingResult = { usage, messagesProduced, systemPrompt };
        return {
          state: result,
          messages: result.messages || [],
          error: (result as any).error,
          tracking: this.trackingResult,
        };
      }

      const result = await doExecute();
      return {
        state: result,
        messages: result.messages || [],
        error: (result as any).error,
      };
    } catch (error) {
      return {
        state: initialState,
        messages: initialState.messages || [],
        error: error as Error,
      };
    }
  }

  /**
   * Execute a graph, optionally with tracking.
   * When tracking is enabled, uses the production executeWithTrackingAndInterrupt.
   */
  private async executeGraph(initialState: TGraphState): Promise<NodeTestResult<TGraphState>> {
    const graph = this.graph!;
    const invokeConfig = this.targetNode
      ? { ...this.config, interruptAfter: [this.targetNode] }
      : this.config;

    try {
      if (this.trackingEnabled) {
        // Use production tracking wrapper
        const tracked = await executeWithTrackingAndInterrupt(
          graph,
          initialState,
          invokeConfig as LangGraphRunnableConfig,
          {
            chatId: initialState.chatId,
            threadId: initialState.threadId,
            graphName: graph.name || "test-graph",
          }
        );

        this.trackingResult = {
          usage: tracked.usage,
          messagesProduced: tracked.messagesProduced,
          systemPrompt: tracked.systemPrompt,
        };

        return {
          state: tracked.result,
          messages: tracked.result.messages || [],
          error: (tracked.result as any).error,
          tracking: this.trackingResult,
        };
      }

      // No tracking - direct invocation
      const result = await graph.invoke(initialState, invokeConfig);

      if (result && result.__interrupt__) {
        const checkpoint = await graph.getState(this.config);
        const state = checkpoint.values as TGraphState;
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
