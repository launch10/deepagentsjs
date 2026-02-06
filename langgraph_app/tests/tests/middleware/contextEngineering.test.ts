/**
 * Context Engineering Middleware Integration Tests
 *
 * Tests that the context engineering middleware correctly:
 * 1. Fetches events from Rails API
 * 2. Summarizes events into context messages
 * 3. Injects context messages before user's message
 *
 * Uses REAL Rails API calls (no mocking) to create events and verify
 * the middleware picks them up.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { isContextMessage } from "langgraph-ai-sdk";
import { Annotation, StateGraph, END, MemorySaver } from "@langchain/langgraph";
import { db, eq, chats, projects } from "@db";
import { DatabaseSnapshotter } from "@services";
import { consumeStream, appScenario } from "@support";
import { createAppBridge, injectAgentContext } from "@api/middleware";
import { NodeMiddleware } from "@middleware";

// ============================================================================
// TEST GRAPH SETUP
// ============================================================================

const ContextTestAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: (curr, next) => [...curr, ...next],
  }),
  threadId: Annotation<string>({
    default: () => "",
    reducer: (_, next) => next,
  }),
  jwt: Annotation<string>({
    default: () => "",
    reducer: (_, next) => next,
  }),
  projectId: Annotation<number | undefined>({
    default: () => undefined,
    reducer: (_, next) => next,
  }),
  // Capture messages at node entry for assertions
  capturedMessages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: (_, next) => next,
  }),
});

type ContextTestState = typeof ContextTestAnnotation.State;

const ContextTestBridge = createAppBridge({
  endpoint: "/api/context-test/stream",
  stateAnnotation: ContextTestAnnotation,
});

// Simple node that injects context (like real nodes do) and captures messages
const captureNode = NodeMiddleware.use({}, (async (state: ContextTestState) => {
  // Inject context at node level (same pattern as websiteBuilder, improveCopy, etc.)
  const messagesWithContext =
    state.projectId && state.jwt
      ? await injectAgentContext({
          graphName: "website",
          projectId: state.projectId,
          jwt: state.jwt,
          messages: state.messages,
        })
      : state.messages;

  return {
    capturedMessages: [...messagesWithContext],
    messages: [new AIMessage("Test response")],
  };
}) as any);

const testGraph = new StateGraph(ContextTestAnnotation)
  .addNode("capture", captureNode)
  .addEdge("__start__", "capture")
  .addEdge("capture", END)
  .compile({
    checkpointer: new MemorySaver(),
    // Use "website" name so the middleware subscribes to image events
    name: "website",
  });

const ContextTestAPI = ContextTestBridge.bind(testGraph);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract text content from context messages (handles both text and multimodal)
 */
function extractContextText(messages: BaseMessage[]): string {
  const contextMessages = messages.filter(isContextMessage);
  const texts = contextMessages.flatMap((m) => {
    if (typeof m.content === "string") return [m.content];
    if (Array.isArray(m.content)) {
      return m.content
        .filter((block: any) => block.type === "text")
        .map((block: any) => block.text);
    }
    return [];
  });
  return texts.join(" ");
}

// ============================================================================
// TESTS
// ============================================================================

describe("Context Engineering Middleware", () => {
  let testThreadId: string;
  let testProjectId: number;

  beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("website_step");

    // Use unique thread ID per test to avoid checkpoint pollution
    testThreadId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Get project from snapshot
    const [project] = await db.select().from(projects).limit(1);
    if (!project) {
      throw new Error("No project found in snapshot");
    }
    testProjectId = project.id;
  });

  describe("Context Injection", () => {
    it("injects context messages for uploaded images", async () => {
      // Create real events via Rails scenario
      await appScenario("create_agent_context_event", {
        project_id: testProjectId,
        event_type: "images.created",
        payload: { filename: "hero.jpg", url: "https://example.com/hero.jpg" },
      });
      await appScenario("create_agent_context_event", {
        project_id: testProjectId,
        event_type: "images.created",
        payload: { filename: "product.png", url: "https://example.com/product.png" },
      });

      const userMessage = new HumanMessage("Update my page");
      const response = await ContextTestAPI.stream({
        messages: [userMessage],
        threadId: testThreadId,
        state: {
          threadId: testThreadId,
          jwt: "test-jwt",
          projectId: testProjectId,
          messages: [userMessage],
        },
      });
      await consumeStream(response);

      const checkpoint = await testGraph.getState({ configurable: { thread_id: testThreadId } });
      const messages = checkpoint.values.capturedMessages as BaseMessage[];
      const contextMessages = messages.filter(isContextMessage);

      expect(contextMessages.length).toBeGreaterThan(0);

      const contextContent = extractContextText(messages);
      expect(contextContent).toContain("uploaded");
      expect(contextContent).toMatch(/hero\.jpg|product\.png|2 images/i);
    });

    it("injects context messages for deleted images", async () => {
      await appScenario("create_agent_context_event", {
        project_id: testProjectId,
        event_type: "images.deleted",
        payload: { filename: "old-logo.png" },
      });

      const userMessage = new HumanMessage("Continue building");
      const response = await ContextTestAPI.stream({
        messages: [userMessage],
        threadId: testThreadId,
        state: {
          threadId: testThreadId,
          jwt: "test-jwt",
          projectId: testProjectId,
          messages: [userMessage],
        },
      });
      await consumeStream(response);

      const checkpoint = await testGraph.getState({ configurable: { thread_id: testThreadId } });
      const messages = checkpoint.values.capturedMessages as BaseMessage[];
      const contextMessages = messages.filter(isContextMessage);

      expect(contextMessages.length).toBeGreaterThan(0);

      const contextContent = extractContextText(messages);
      expect(contextContent).toContain("deleted");
      expect(contextContent).toMatch(/old-logo\.png|1 image/i);
    });

    it("context messages appear before user's current message", async () => {
      await appScenario("create_agent_context_event", {
        project_id: testProjectId,
        event_type: "images.created",
        payload: { filename: "test.jpg", url: "https://example.com/test.jpg" },
      });

      const userMessage = new HumanMessage("Build my website");
      const response = await ContextTestAPI.stream({
        messages: [userMessage],
        threadId: testThreadId,
        state: {
          threadId: testThreadId,
          jwt: "test-jwt",
          projectId: testProjectId,
          messages: [userMessage],
        },
      });
      await consumeStream(response);

      const checkpoint = await testGraph.getState({ configurable: { thread_id: testThreadId } });
      const messages = checkpoint.values.capturedMessages as BaseMessage[];

      const contextIndex = messages.findIndex(isContextMessage);
      const userMessageIndex = messages.findIndex(
        (msg) =>
          msg instanceof HumanMessage &&
          !isContextMessage(msg) &&
          typeof msg.content === "string" &&
          msg.content === "Build my website"
      );

      expect(contextIndex).toBeGreaterThanOrEqual(0);
      expect(userMessageIndex).toBeGreaterThan(contextIndex);
    });
  });

  describe("No Events", () => {
    it("does not inject context when no events exist", async () => {
      // Use a project ID with no events to guarantee clean state
      const emptyProjectId = 99999;
      const userMessage = new HumanMessage("Hello");
      const response = await ContextTestAPI.stream({
        messages: [userMessage],
        threadId: testThreadId,
        state: {
          threadId: testThreadId,
          jwt: "test-jwt",
          projectId: emptyProjectId,
          messages: [userMessage],
        },
      });
      await consumeStream(response);

      const checkpoint = await testGraph.getState({ configurable: { thread_id: testThreadId } });
      const messages = checkpoint.values.capturedMessages as BaseMessage[];
      const contextMessages = messages.filter(isContextMessage);

      expect(contextMessages.length).toBe(0);
    });
  });

  describe("Skips when missing context", () => {
    it("skips when no projectId in state", async () => {
      await appScenario("create_agent_context_event", {
        project_id: testProjectId,
        event_type: "images.created",
        payload: { filename: "test.jpg" },
      });

      const userMessage = new HumanMessage("Hello");
      const response = await ContextTestAPI.stream({
        messages: [userMessage],
        threadId: testThreadId,
        state: {
          threadId: testThreadId,
          jwt: "test-jwt",
          messages: [userMessage],
          // No projectId
        },
      });
      await consumeStream(response);

      const checkpoint = await testGraph.getState({ configurable: { thread_id: testThreadId } });
      const messages = checkpoint.values.capturedMessages as BaseMessage[];
      const contextMessages = messages.filter(isContextMessage);

      expect(contextMessages.length).toBe(0);
    });

    it("skips when no jwt in state", async () => {
      await appScenario("create_agent_context_event", {
        project_id: testProjectId,
        event_type: "images.created",
        payload: { filename: "test.jpg" },
      });

      const userMessage = new HumanMessage("Hello");
      const response = await ContextTestAPI.stream({
        messages: [userMessage],
        threadId: testThreadId,
        state: {
          threadId: testThreadId,
          projectId: testProjectId,
          messages: [userMessage],
          // No jwt
        },
      });
      await consumeStream(response);

      const checkpoint = await testGraph.getState({ configurable: { thread_id: testThreadId } });
      const messages = checkpoint.values.capturedMessages as BaseMessage[];
      const contextMessages = messages.filter(isContextMessage);

      expect(contextMessages.length).toBe(0);
    });
  });
});
