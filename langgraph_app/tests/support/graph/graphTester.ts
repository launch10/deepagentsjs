import { HumanMessage, BaseMessage } from '@langchain/core/messages';
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { type CoreGraphState } from "@state";
import { generateUUID, type ConsoleError } from "@types";
import { isGraphInterrupt } from "@langchain/langgraph";
import { runScenario } from '@services';
import { interruptContext } from "app/core/node/middleware";
import { vi } from 'vitest';
export interface NodeTestResult<TState extends CoreGraphState> {
    state: TState;
    output: any;
    messages: BaseMessage[];
    error?: Error;
    promptSpy?: Map<string, string[]>;
    serviceSpy?: Map<string, any[]>;
}

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
 * - Works seamlessly with nodes that extend BaseNode
 * 
 * How it works:
 * 1. Set TEST_INTERRUPT_NODE environment variable to the target node name
 * 2. Nodes extending BaseNode will check this and interrupt after execution
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
    private initialState: Partial<TGraphState> = {};
    private config: Partial<LangGraphRunnableConfig> = {};
    private graph: any;
    private websiteName?: string; // Store project name for deferred loading
    private capturePrompts: string[] = [];
    private capturedPromptOutputs: Map<string, string[]> = new Map();
    private captureServices: string[] = [];
    private capturedserviceSpy: Map<string, any[]> = new Map();
    private scenario?: string;

    constructor() {
        // Initialize with an in-memory checkpointer for tests
        this.config = {
            configurable: {
                thread_id: generateUUID(),
            }
        };

        this.initialState = {
            jwt: "test-jwt",
            accountId: 1,
        }
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
    withGraph(graph: any): GraphTestBuilder<TGraphState> {
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
     * Load project thread ID if a project name was specified
     */
    private async loadThread(): Promise<void> {
        if (!this.websiteName) {
            return;
        }

        // Dynamically import to avoid circular dependencies
        const { ProjectModel } = await import('@models');
        const project = await ProjectModel.findBy({ name: this.websiteName });
        
        if (!project?.threadId) {
            throw new Error(`Project "${this.websiteName}" not found or has no thread_id`);
        }
        
        // Update config with the project's thread ID
        if (!this.config.configurable) {
            this.config.configurable = {};
        }
        this.config.configurable.thread_id = project.threadId;
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
     * Capture outputs from specified prompt functions
     */
    withPromptSpy(promptNames: string[]): GraphTestBuilder<TGraphState> {
        this.capturePrompts = promptNames;
        return this;
    }

    /**
     * Capture outputs from specified service classes
     */
    withServiceSpy(serviceNames: string[]): GraphTestBuilder<TGraphState> {
        this.captureServices = serviceNames;
        return this;
    }

    /**
     * Execute the graph up to the target node and return the result
     */
    async execute(): Promise<NodeTestResult<TGraphState>> {
        if (!this.prompt) {
            throw new Error("Prompt is required. Use .withPrompt() to set it.");
        }
        if (!this.graph) {
            throw new Error("Graph is required. Use .withGraph() to set it.");
        }

        // Set up prompt capturing if requested
        if (this.capturePrompts.length > 0) {
            await this.setupPromptCapturing();
        }
        
        // Set up service capturing if requested
        if (this.captureServices.length > 0) {
            await this.setupServiceCapturing();
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
        // Prepare initial state with the user message
        const userMessage = new HumanMessage(this.prompt);
        const initialState: TGraphState = {
            ...this.initialState,
            consoleErrors,
            messages: [...initialStateMessages, userMessage],
        } as TGraphState;

        try {
            const testGraph = this.graph; 

            const result = this.targetNode 
                ? await interruptContext.run({ nodeName: this.targetNode }, async () => {
                    return await testGraph.invoke(initialState, this.config);
                })
                : await testGraph.invoke(initialState, this.config);
            
            // Check if the result contains an interrupt
            if (result && result.__interrupt__) {
                // The state at the time of interrupt is the result minus the __interrupt__ key
                const { __interrupt__, ...stateAtInterrupt } = result;
                return {
                    state: stateAtInterrupt,
                    output: stateAtInterrupt,
                    messages: stateAtInterrupt.messages || [],
                    error: undefined,
                    promptSpy: this.capturedPromptOutputs,
                    serviceSpy: this.capturedserviceSpy
                };
            }
            
            return {
                state: result,
                messages: result.messages || [],
                error: result.error,
                output: result,
                promptSpy: this.capturedPromptOutputs,
                serviceSpy: this.capturedserviceSpy
            }
        } catch (error) {
            // Check if this is a GraphInterrupt - this is expected for test interrupts
            console.log(`error!!!`)
            console.log(error)
            if (isGraphInterrupt(error)) {
                console.log(`isGraphInterrupt`)
                // Extract the interrupt value which should contain our state
                const interruptValue = (error as any).interrupts?.[0]?.value || error.value;
                if (interruptValue && interruptValue.state) {
                    return {
                        state: interruptValue.state,
                        output: interruptValue.state,
                        messages: interruptValue.state.messages || [],
                        error: undefined,
                        promptSpy: this.capturedPromptOutputs,
                        serviceSpy: this.capturedserviceSpy
                    };
                }
                // Fallback: use the initial state with updates from the error
                return {
                    state: { ...initialState, ...(interruptValue || {}) },
                    output: interruptValue || null,
                    messages: initialState.messages || [],
                    error: undefined,
                    promptSpy: this.capturedPromptOutputs,
                    serviceSpy: this.capturedserviceSpy
                };
            }
            
            // Regular error - return as error
            return {
                state: initialState,
                output: null,
                messages: initialState.messages || [],
                error: error as Error,
                promptSpy: this.capturedPromptOutputs,
                serviceSpy: this.capturedserviceSpy
            };
        } finally {
            // Clean up prompt mocks if they were set up
            if (this.capturePrompts.length > 0) {
                this.cleanupPromptCapturing();
            }
            // Clean up service mocks if they were set up
            if (this.captureServices.length > 0) {
                this.cleanupServiceCapturing();
            }
        }
    }

    /**
     * Setup prompt capturing using vi.doMock
     */
    private async setupPromptCapturing(): Promise<void> {
        const capturedOutputs = this.capturedPromptOutputs;
        const promptsToCapture = this.capturePrompts;
        
        // Clear any existing module mocks and caches
        vi.resetModules();
        
        // Mock the @prompts module to capture outputs
        vi.doMock('@prompts', async (importOriginal) => {
            const actual = await importOriginal() as any;
            const mockedPrompts: any = {};
            
            // Create spies for each requested prompt
            for (const name of promptsToCapture) {
                if (actual[name]) {
                    mockedPrompts[name] = vi.fn().mockImplementation(async (...args: any[]) => {
                        const output = await actual[name](...args);
                        
                        // Store the output
                        if (!capturedOutputs.has(name)) {
                            capturedOutputs.set(name, []);
                        }
                        capturedOutputs.get(name)!.push(output);
                        
                        return output;
                    });
                }
            }
            
            // Return the module with mocked functions
            return {
                ...actual,
                ...mockedPrompts
            };
        });
        
        // Force reload of the graph with mocked prompts
        // We need to re-import the graph after setting up the mock
        const { routerGraph } = await import('@graphs');
        this.graph = routerGraph;
    }

    /**
     * Clean up prompt mocks
     */
    private cleanupPromptCapturing(): void {
        vi.doUnmock('@prompts');
        vi.clearAllMocks();
    }

    /**
     * Setup service capturing using vi.doMock
     */
    private async setupServiceCapturing(): Promise<void> {
        const capturedOutputs = this.capturedserviceSpy;
        const servicesToCapture = this.captureServices;
        
        // Clear any existing module mocks and caches
        vi.resetModules();
        
        // Mock the @services module to capture outputs
        vi.doMock('@services', async (importOriginal) => {
            const actual = await importOriginal() as any;
            const mockedServices: any = {};
            
            // Create mocked classes for each requested service
            for (const name of servicesToCapture) {
                if (actual[name]) {
                    // Create a mocked class that extends the original
                    mockedServices[name] = class extends actual[name] {
                        async execute(...args: any[]) {
                            const output = await super.execute(...args);
                            
                            // Store the output
                            if (!capturedOutputs.has(name)) {
                                capturedOutputs.set(name, []);
                            }
                            capturedOutputs.get(name)!.push(output);
                            
                            return output;
                        }
                    };
                }
            }
            
            // Return the module with mocked services
            return {
                ...actual,
                ...mockedServices
            };
        });
        
        // Force reload of the graph with mocked services
        // We need to re-import the graph after setting up the mock
        const { routerGraph } = await import('@graphs');
        this.graph = routerGraph;
    }

    /**
     * Clean up service mocks
     */
    private cleanupServiceCapturing(): void {
        vi.doUnmock('@services');
        vi.clearAllMocks();
    }

    /**
     * Helper to create a test for a specific node output
     */
    async expectOutput(assertion: (output: any) => void): Promise<void> {
        const result = await this.execute();
        if (result.error) {
            throw result.error;
        }
        assertion(result.output);
    }

    /**
     * Helper to get just the node's output for a specific field
     */
    async getOutput<T = any>(field?: string): Promise<T> {
        const result = await this.execute();
        if (result.error) {
            throw result.error;
        }
        return field ? result.output[field] : result.output;
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