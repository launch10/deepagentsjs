import { describe, it, expect, vi, afterEach } from 'vitest';
import { ErrorReporters } from '@core';
import { getNodeContext, NodeMiddleware, NodeMiddlewareFactory, NodeCache } from '@middleware';
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { getLLM, LLMManager } from "@core";

const getNodeName = () => {
    const context = getNodeContext();
    if (!context) throw new Error('No context found');
    return context.name;
};

describe('Node Core', () => {
  afterEach(async () => {
      LLMManager.resetTestResponses();
      await NodeCache.clear()
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

      LLMManager.configureTestResponses({
        [graphName]: {
          [nodeName]: ["Hello, nice to meet you!"],
        },
      });

      const node = NodeMiddleware.use(
        { notifications: { taskName: 'Any Task Name I Want' } },
        async (state: any, config: LangGraphRunnableConfig) => {
          const output = await getLLM().invoke("Hello")
          console.log(output)
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

          console.log(calls)
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

    it('caches node results based on keyFunc', async() => {
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
        .compile();

      // First call with userId "user1" and query "query1"
      const result1 = await graph.invoke({ userId: "user1", query: "user1" });
      expect(result1.result).toBe("Result for user1");
      expect(executionCount).toBe(1);

      // Second call with same userId but different query - should use cache
      const result2 = await graph.invoke({ userId: "user1", query: "user1" });
      expect(result2.result).toBe("Result for user1"); // Returns cached result
      expect(executionCount).toBe(1); // Should not increment

      // Third call with different userId - should execute again
      const result3 = await graph.invoke({ userId: "user2", query: "user2" });
      expect(result3.result).toBe("Result for user2");
      expect(executionCount).toBe(2);

      // Fourth call with first userId again - should use cache
      const result4 = await graph.invoke({ userId: "user1", query: "user1" });
      expect(result4.result).toBe("Result for user1"); // Returns original cached result
      expect(executionCount).toBe(2); // Should not increment

      // Fifth call with different userId - should execute again
      const result5 = await graph.invoke({ userId: "user2", query: "user2" });
      expect(result5.result).toBe("Result for user2");
      expect(executionCount).toBe(2);

      // Sixth call with different userId - should execute again
      const result6 = await graph.invoke({ userId: "user3", query: "user3" });
      expect(result6.result).toBe("Result for user3");
      expect(executionCount).toBe(3);
    })
  });
});
