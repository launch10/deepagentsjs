import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { MemorySaver } from '@langchain/langgraph';
import { ErrorReporters } from '@core';
import { getNodeContext, NodeMiddleware, NodeMiddlewareFactory, NodeCache } from '@core';
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { getLLM, LLMManager } from "@core";
import { kebabCase } from "change-case";
import * as fs from 'fs';
import * as path from 'path';
import { testGraph } from '@support';

const getNodeName = () => {
    const context = getNodeContext();
    if (!context) throw new Error('No context found');
    return context.name;
};

describe('Node Core', () => {
  // These are the only tests in the application where we actually want
  // to test the NodeCache middleware, otherwise we want to use Polly/fixtures
  beforeAll(async () => {
    NodeCache.enable();
  });

  afterAll(async () => {
    NodeCache.disable();
  });

  afterEach(async () => {
      LLMManager.resetTestResponses();
      await NodeCache.clear();
  })

  describe('Middlewares', () => {
    it('applies middlewares in order of addMiddleware calls', async () => {
      const executionOrder: string[] = [];

      const middlewareA = (node: any) => {
        return async (state: any, config: LangGraphRunnableConfig) => {
          executionOrder.push('A-before');
          const result = await node(state, config);
          executionOrder.push('A-after');
          return result;
        };
      };

      const middlewareB = (node: any) => {
        return async (state: any, config: LangGraphRunnableConfig) => {
          executionOrder.push('B-before');
          const result = await node(state, config);
          executionOrder.push('B-after');
          return result;
        };
      };

      const middlewareC = (node: any) => {
        return async (state: any, config: LangGraphRunnableConfig) => {
          executionOrder.push('C-before');
          const result = await node(state, config);
          executionOrder.push('C-after');
          return result;
        };
      };

      const testMiddleware = new NodeMiddlewareFactory()
        .addMiddleware('A', middlewareA)
        .addMiddleware('C', middlewareC)
        .addMiddleware('B', middlewareB)

      const node = testMiddleware.use(
        {},
        async (state: any, config: LangGraphRunnableConfig) => {
          executionOrder.push('node');
          return {};
        }
      );

      const graph = new StateGraph(Annotation.Root({}))
        .addNode('testNode', node)
        .addEdge('__start__', 'testNode')
        .addEdge('testNode', '__end__')
        .compile();

      await graph.invoke({});

      expect(executionOrder).toEqual(['A-before', 'C-before', 'B-before', 'node', 'B-after', 'C-after', 'A-after']);
    });

    it('decorates context', async () => {
      let nodeName: string | undefined;

      const node = NodeMiddleware.use(
        {},
        async  (state: any, config: LangGraphRunnableConfig) => {
            nodeName = getNodeName();
            return {};
        }
      );

      const graph = new StateGraph(Annotation.Root({ }))
        .addNode('fancyPantsNode', node)
        .addEdge("__start__", "fancyPantsNode")
        .addEdge("fancyPantsNode", "__end__")
        .compile();

      await graph.invoke({});
        
      expect(nodeName).toBe('fancyPantsNode');
    });

    it('decorates notifications', async () => {
      let graphName = 'test-graph';
      let nodeName = 'notificationNode';      

      LLMManager.configureFixtures({
        [graphName]: {
          [nodeName]: ["Hello, nice to meet you!"],
        },
      });

      const node = NodeMiddleware.use(
        { notifications: { taskName: 'Any Task Name I Want' } },
        async (state: any, config: LangGraphRunnableConfig) => {
          const output = await getLLM().invoke("Hello")
          return {}
        }
      )

      const graph = new StateGraph(Annotation.Root({ }))
        .addNode('notificationNode', node)
        .addEdge("__start__", "notificationNode")
        .addEdge("notificationNode", "__end__")
        .compile({ name: graphName });

      const stream = await graph.stream({}, { 
        context: {
          graphName: graphName,
        },
        streamMode: ['custom'] 
      } as any);

      let collectedEvents = []
      for await (const chunk of stream) {
        const chunkArray = chunk as [string, any];
        let kind: string;
        let data: any;
        [kind, data] = chunkArray;
        if (kind === "custom") {
          collectedEvents.push(data);
        }
      }

      expect(collectedEvents).toEqual([
        {
          id: expect.any(String),
          event: "NOTIFY_TASK_START",
          task: {
            id: expect.any(String),
            title: "Any Task Name I Want",
          },
        },
        {
          id: expect.any(String),
          event: "NOTIFY_TASK_COMPLETE",
          task: {
            id: expect.any(String),
            title: "Any Task Name I Want",
          },
        },
      ]);
    });

    describe("Error Handling", () => {
        it('bubbles up errors by default', async () => {
          let nodeName: string | undefined;
          let Rollbar = { log: (error: Error) => console.log(error), error: (error: Error) => console.warn(error) }
          let calls = {errorNode: 0, downStreamNode: 0};

          const spy = vi.spyOn(console, 'error');
          const rollbarSpy = vi.spyOn(Rollbar, 'error');

          ErrorReporters.addReporter('console')
                        .addReporter('rollbar', Rollbar.error);
            
          const errorNode = NodeMiddleware.use(
            {},
            async (state: any, config: LangGraphRunnableConfig) => {
                calls['errorNode']++;
                nodeName = getNodeName();
                throw new Error('Test error');
            }
          )

          const downStreamNode = NodeMiddleware.use(
            {},
            async (state: any, config: LangGraphRunnableConfig) => {
                calls['downStreamNode']++;
                nodeName = getNodeName();
                throw new Error('Test error');
            }
          )

          const graph = new StateGraph(Annotation.Root({ error: Annotation<{ message: string, node: string } | undefined>() }))
            .addNode('errorNode', errorNode)
            .addNode('downStreamNode', downStreamNode)
            .addEdge("__start__", "errorNode")
            .addEdge("errorNode", "downStreamNode")
            .addEdge("downStreamNode", "__end__")
            .compile();

          const state = await graph.invoke({});
          expect(state.error).toEqual({
            message: 'Test error',
            node: 'errorNode'
          })
          expect(calls).toEqual({
            errorNode: 1,
            downStreamNode: 0
          })

          expect(spy).toHaveBeenCalled();
          expect(spy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Test error' }));

          expect(rollbarSpy).toHaveBeenCalled();
          expect(rollbarSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Test error' }));

          expect(nodeName).toBe('errorNode');
        });

        it('throws when behavior is throw', async () => {
          let nodeName: string | undefined;
          let Rollbar = { log: (error: Error) => console.log(error), error: (error: Error) => console.warn(error) }
          let calls = {errorNode: 0, downStreamNode: 0};

          const spy = vi.spyOn(console, 'error');
          const rollbarSpy = vi.spyOn(Rollbar, 'error');

          ErrorReporters.addReporter('console')
                        .addReporter('rollbar', Rollbar.error);
            
          const errorNode = NodeMiddleware.use(
            { error: { behavior: 'throw' } },
            async (state: any, config: LangGraphRunnableConfig) => {
                calls['errorNode']++;
                nodeName = getNodeName();
                throw new Error('Test error');
            }
          )

          const downStreamNode = NodeMiddleware.use(
            {},
            async (state: any, config: LangGraphRunnableConfig) => {
                calls['downStreamNode']++;
                nodeName = getNodeName();
            }
          )

          const graph = new StateGraph(Annotation.Root({ error: Annotation<{ message: string, node: string } | undefined>() }))
            .addNode('errorNode', errorNode)
            .addNode('downStreamNode', downStreamNode)
            .addEdge("__start__", "errorNode")
            .addEdge("errorNode", "downStreamNode")
            .addEdge("downStreamNode", "__end__")
            .compile();

          await expect(graph.invoke({})).rejects.toThrow('Test error');

          expect(calls).toEqual({
            errorNode: 1,
            downStreamNode: 0
          })

          expect(spy).toHaveBeenCalled();
          expect(spy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Test error' }));

          expect(rollbarSpy).toHaveBeenCalled();
          expect(rollbarSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Test error' }));

          expect(nodeName).toBe('errorNode');
        });
    });

    describe('Polly HTTP Recording', () => {
      const getRecordingPath = (nodeName: string) => {
        const recordingsDir = path.join(process.cwd(), 'tests', 'recordings');
        const dirs = fs.readdirSync(recordingsDir);
        const recordingFile = dirs.find(dir => {
          return dir.startsWith(kebabCase(nodeName))
        });
        return recordingFile ? path.join(recordingsDir, recordingFile, 'recording.har') : null;
      };

      const cleanupRecording = (nodeName: string) => {
        const recordingPath = getRecordingPath(nodeName);
        if (recordingPath && fs.existsSync(recordingPath)) {
          fs.unlinkSync(recordingPath);
        }
      };

      // Skip for speed, but technically this is a valid test
      it.skip('records and replays HTTP requests', async () => {
        let graphName = 'polly-test-graph';
        let nodeName = 'polly-node';

        cleanupRecording(nodeName);

        const node = NodeMiddleware.use(
          { },
          async (state: any, config: LangGraphRunnableConfig) => {
            const output = await getLLM().invoke("Test prompt");
            return { result: output.content };
          }
        );

        const graph = new StateGraph(Annotation.Root({ result: Annotation<string | undefined>() }))
          .addNode(nodeName, node)
          .addEdge("__start__", nodeName)
          .addEdge(nodeName, "__end__")
          .compile({ name: graphName });

        const result = await graph.invoke({}, {
          context: {
            graphName: graphName,
          },
        } as any);

        const recordingPath = getRecordingPath(nodeName);
        expect(recordingPath).not.toBeNull();
        expect(fs.existsSync(recordingPath!)).toBe(true);

        const recordingContent = fs.readFileSync(recordingPath!, 'utf-8');
        const recording = JSON.parse(recordingContent);
        expect(recording.log.entries.length).toBeGreaterThan(0);
      });

      it('does not hit polly when LLM Manager has fixtures configured', async () => {
        let graphName = 'no-polly-graph';
        let nodeName = 'noPollyNode';

        cleanupRecording(nodeName);

        LLMManager.configureFixtures({
          [graphName]: {
            [nodeName]: ["Response without Polly"],
          },
        });

        const node = NodeMiddleware.use(
          { },
          async (state: any, config: LangGraphRunnableConfig) => {
            const output = await getLLM().invoke("Test prompt");
            return { result: output.content };
          }
        );

        const graph = new StateGraph(Annotation.Root({ result: Annotation<string | undefined>() }))
          .addNode(nodeName, node)
          .addEdge("__start__", nodeName)
          .addEdge(nodeName, "__end__")
          .compile({ name: graphName });

        const result = await graph.invoke({}, {
          context: {
            graphName: graphName,
          },
        } as any);

        expect(result.result).toBe("Response without Polly");

        const recordingPath = getRecordingPath(nodeName);
        expect(recordingPath).toBeNull();
      });
    });

    describe('Interrupts', () => {
      it('stops execution after the specified node', async () => {
        const StateAnnotation = Annotation.Root({
          completed: Annotation<string[]>({
            reducer: (state: string[] = [], update: string[]) => [...state, ...update]
          })
        });

        const node1 = NodeMiddleware.use(
          {},
          async (state: any, config: LangGraphRunnableConfig) => {
            return { completed: ['node1'] };
          }
        );

        const node2 = NodeMiddleware.use(
          {},
          async (state: any, config: LangGraphRunnableConfig) => {
            return { completed: [...state.completed, 'node2'] };
          }
        );

        const node3 = NodeMiddleware.use(
          {},
          async (state: any, config: LangGraphRunnableConfig) => {
            return { completed: [...state.completed, 'node3'] };
          }
        );

        const graph = new StateGraph(StateAnnotation)
          .addNode('firstNode', node1)
          .addNode('secondNode', node2)
          .addNode('thirdNode', node3)
          .addEdge('__start__', 'firstNode')
          .addEdge('firstNode', 'secondNode')
          .addEdge('secondNode', 'thirdNode')
          .addEdge('thirdNode', '__end__')
          .compile({ checkpointer: new MemorySaver() });

        type StateType = typeof StateAnnotation.State;
        const result = await testGraph<StateType>()
          .withGraph(graph)
          .withPrompt('Test interrupt')
          .stopAfter('secondNode')
          .execute();

        expect(result.state.completed).toEqual(['node1', 'node2']);
      });

      it('interrupts correctly even when graph completes all nodes', async () => {
        const StateAnnotation = Annotation.Root({
          steps: Annotation<string[]>({
            reducer: (state: string[] = [], update: string[]) => [...state, ...update]
          })
        });

        const node1 = NodeMiddleware.use(
          {},
          async (state: any, config: LangGraphRunnableConfig) => {
            return { steps: ['step1'] };
          }
        );

        const node2 = NodeMiddleware.use(
          {},
          async (state: any, config: LangGraphRunnableConfig) => {
            return { steps: [...state.steps, 'step2'] };
          }
        );

        const graph = new StateGraph(StateAnnotation)
          .addNode('a', node1)
          .addNode('b', node2)
          .addEdge('__start__', 'a')
          .addEdge('a', 'b')
          .addEdge('b', '__end__')
          .compile({ checkpointer: new MemorySaver() });

        type StateType = typeof StateAnnotation.State;
        const result = await testGraph<StateType>()
          .withGraph(graph)
          .withPrompt('Test')
          .stopAfter('b')
          .execute();

        expect(result.state.steps).toEqual(['step1', 'step2']);
      });
    });

    // TODO: Re-enable cache
    it.skip('caches node results based on keyFunc', async() => {
      NodeCache.clear();

      let executionCount = 0;
      
      const StateAnnotation = Annotation.Root({
        userId: Annotation<string>,
        query: Annotation<string>,
        result: Annotation<string | undefined>
      });
      type StateType = typeof StateAnnotation.State;
      const node = NodeMiddleware.use(
        {
          cache: {
            keyFunc: (state: StateType) => state.userId
          }
        },
        async (state: typeof StateAnnotation.State, config: LangGraphRunnableConfig) => {
          executionCount++;
          return { result: `Result for ${state.query}` };
        }
      );

      const graph = new StateGraph(StateAnnotation)
        .addNode('cachedNode', node)
        .addEdge("__start__", "cachedNode")
        .addEdge("cachedNode", "__end__")
        .compile({ checkpointer: new MemorySaver() });

      // First call with userId "user1" and query "query1"
      const result1 = await graph.invoke({ userId: "user1", query: "user1" }, { configurable: {thread_id: 'thread1'}});
      expect(executionCount).toBe(1);

      // Second call with same userId but different query - should use cache
      const result2 = await graph.invoke({ userId: "user1", query: "user1" }, { configurable: {thread_id: 'thread1'}});
      expect(result2.result).toBe("Result for user1"); // Returns cached result
      expect(executionCount).toBe(1); // Should not increment

      // Third call with different userId - should execute again
      const result3 = await graph.invoke({ userId: "user2", query: "user2" }, { configurable: {thread_id: 'thread2'}});
      expect(result3.result).toBe("Result for user2");
      expect(executionCount).toBe(2);

      // Fourth call with first userId again - should use cache
      const result4 = await graph.invoke({ userId: "user1", query: "user1" }, { configurable: {thread_id: 'thread1'}});
      expect(result4.result).toBe("Result for user1"); // Returns original cached result
      expect(executionCount).toBe(2); // Should not increment

      // Fifth call with different userId - should execute again
      const result5 = await graph.invoke({ userId: "user2", query: "user2" }, { configurable: {thread_id: 'thread2'}});
      expect(result5.result).toBe("Result for user2");
      expect(executionCount).toBe(2);

      // Sixth call with different userId - should execute again
      const result6 = await graph.invoke({ userId: "user3", query: "user3" }, { configurable: {thread_id: 'thread3'}});
      expect(result6.result).toBe("Result for user3");
      expect(executionCount).toBe(3);
    })
  });
});
