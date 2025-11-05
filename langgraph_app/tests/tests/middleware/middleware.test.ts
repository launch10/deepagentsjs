import { describe, it, expect, vi, afterEach } from 'vitest';
import { ErrorReporters } from '@core';
import { getNodeContext, NodeMiddleware, NodeMiddlewareFactory } from '@middleware';
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
  afterEach(() => {
      LLMManager.resetTestResponses();
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

    it('reports errors', async () => {
      let nodeName: string | undefined;
      let Rollbar = { log: (error: Error) => console.log(error), error: (error: Error) => console.warn(error) }

      const spy = vi.spyOn(console, 'error');
      const rollbarSpy = vi.spyOn(Rollbar, 'error');

      ErrorReporters.addReporter('console')
                    .addReporter('rollbar', Rollbar.error);
        
      const node = NodeMiddleware.use(
        {},
        async (state: any, config: LangGraphRunnableConfig) => {
            nodeName = getNodeName();
            throw new Error('Test error');
        }
      )

      const graph = new StateGraph(Annotation.Root({ }))
        .addNode('errorNode', node)
        .addEdge("__start__", "errorNode")
        .addEdge("errorNode", "__end__")
        .compile();

      await expect(graph.invoke({})).rejects.toThrow('Test error');

      expect(spy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Test error' }));

      expect(rollbarSpy).toHaveBeenCalled();
      expect(rollbarSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Test error' }));

      expect(nodeName).toBe('errorNode');
    });

    it('caches node results based on keyFunc', async() => {
      let executionCount = 0;
      
      const StateAnnotation = Annotation.Root({
        userId: Annotation<string>,
        query: Annotation<string>,
        result: Annotation<string | undefined>
      });

      const node = NodeMiddleware.use(
        {
          cache: {
            keyFunc: (state: typeof StateAnnotation.State) => state.userId
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
      const result1 = await graph.invoke({ userId: "user1", query: "query1" });
      expect(result1.result).toBe("Result for query1");
      expect(executionCount).toBe(1);

      // Second call with same userId but different query - should use cache
      const result2 = await graph.invoke({ userId: "user1", query: "query2" });
      expect(result2.result).toBe("Result for query1"); // Returns cached result
      expect(executionCount).toBe(1); // Should not increment

      // Third call with different userId - should execute again
      const result3 = await graph.invoke({ userId: "user2", query: "query3" });
      expect(result3.result).toBe("Result for query3");
      expect(executionCount).toBe(2);

      // Fourth call with first userId again - should use cache
      const result4 = await graph.invoke({ userId: "user1", query: "query4" });
      expect(result4.result).toBe("Result for query1"); // Returns original cached result
      expect(executionCount).toBe(2); // Should not increment
    })
  });
});
