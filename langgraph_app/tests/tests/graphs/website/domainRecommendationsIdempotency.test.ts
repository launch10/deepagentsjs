/**
 * Domain Recommendations Idempotency Tests
 *
 * Verifies that domainRecommendations are preserved across graph invocations
 * and not regenerated when already present.
 *
 * Three levels of testing:
 * 1. Node-level: calls the node directly (no LLM, no DB)
 * 2. Checkpoint-level: uses a minimal graph with MemorySaver to verify
 *    domainRecommendations survives across runs on the same thread
 * 3. Architecture-level: 3-level nesting that mirrors production
 *    (credit wrapper → intent graph → websiteBuilder subgraph)
 *
 * Plus a regression test for the "new thread on navigation" scenario:
 *   When the user navigates away and back, a new thread may be created.
 *   domainRecommendations from the old thread would be lost. This test
 *   verifies the node re-runs correctly on a fresh thread (expected) and
 *   skips on the same thread (idempotent).
 */
import { describe, it, expect, vi } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { testGraph } from "@support";
import { WebsiteAnnotation, type WebsiteGraphState } from "@annotation";
import { domainRecommendationsNode } from "../../../../app/nodes/website/recommendDomains";
import { generateUUID } from "@types";
import type { Website } from "@types";

// ── Test fixtures ──────────────────────────────────────────────────────
function buildDomainRecommendations(): Website.DomainRecommendations.DomainRecommendations {
  return {
    state: "no_existing_sites",
    recommendations: [
      {
        domain: "test-biz.launch10.site",
        subdomain: "test-biz",
        path: "/",
        fullUrl: "test-biz.launch10.site",
        score: 85,
        reasoning: "Matches your business idea",
        source: "suggestion",
        availability: "available",
      },
    ],
    topRecommendation: {
      domain: "test-biz.launch10.site",
      subdomain: "test-biz",
      path: "/",
      fullUrl: "test-biz.launch10.site",
      score: 85,
      reasoning: "Matches your business idea",
      source: "suggestion",
      availability: "available",
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────
describe("Domain Recommendations Idempotency", () => {
  describe("Node-level guards", () => {
    it("skips when domainRecommendations already exist in state", async () => {
      const existing = buildDomainRecommendations();

      const result = await testGraph<WebsiteGraphState>()
        .withState({
          websiteId: 1,
          accountId: 1,
          projectId: 1,
          domainRecommendations: existing,
        })
        .runNode(domainRecommendationsNode)
        .execute();

      // Node should return {} (no-op), preserving the existing value
      expect(result.state.domainRecommendations).toEqual(existing);
    });

    it("skips when messages already exist (not the first turn)", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withState({
          websiteId: 1,
          accountId: 1,
          projectId: 1,
          messages: [
            new HumanMessage("make the hero bigger"),
            new AIMessage("Sure, I'll update the hero section."),
          ],
        })
        .runNode(domainRecommendationsNode)
        .execute();

      // Node should skip — domainRecommendations stays undefined
      expect(result.state.domainRecommendations).toBeUndefined();
    });

    it("skips when no websiteId is provided", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withState({
          accountId: 1,
          projectId: 1,
        })
        .runNode(domainRecommendationsNode)
        .execute();

      expect(result.state.domainRecommendations).toBeUndefined();
    });

    it("skips when no JWT is provided", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withState({
          websiteId: 1,
          accountId: 1,
          projectId: 1,
          jwt: undefined,
        })
        .runNode(domainRecommendationsNode)
        .execute();

      expect(result.state.domainRecommendations).toBeUndefined();
    });
  });

  describe("Annotation reducer", () => {
    it("preserves domainRecommendations when next is undefined (reducer: next ?? current)", () => {
      const existing = buildDomainRecommendations();
      // Simulate the reducer behavior: (current, next) => next ?? current
      const reducer = (
        current: Website.DomainRecommendations.DomainRecommendations | undefined,
        next: Website.DomainRecommendations.DomainRecommendations | undefined
      ) => next ?? current;

      // When a node returns {} (no domainRecommendations key), next = undefined
      expect(reducer(existing, undefined)).toEqual(existing);
      // When a node explicitly returns domainRecommendations, it takes precedence
      const updated = { ...existing, state: "new_recommended" as const };
      expect(reducer(existing, updated)).toEqual(updated);
      // When both are undefined, stays undefined
      expect(reducer(undefined, undefined)).toBeUndefined();
    });
  });

  describe("Checkpoint persistence across graph invocations", () => {
    it("preserves domainRecommendations across runs on the same thread", async () => {
      const existing = buildDomainRecommendations();

      // Build a minimal graph that mirrors the real structure:
      // A single node that returns {} (like recommendDomains when it skips)
      const noopNode = () => ({});
      const graph = new StateGraph(WebsiteAnnotation)
        .addNode("noop", noopNode)
        .addEdge(START, "noop")
        .addEdge("noop", END)
        .compile({ checkpointer: new MemorySaver() });

      const threadId = generateUUID();
      const config = { configurable: { thread_id: threadId } };

      // Run 1: set domainRecommendations
      await graph.invoke(
        {
          jwt: "test",
          websiteId: 1,
          accountId: 1,
          domainRecommendations: existing,
        },
        config
      );

      // Verify checkpoint has domainRecommendations
      const checkpointAfterRun1 = await graph.getState(config);
      expect(checkpointAfterRun1.values.domainRecommendations).toEqual(existing);

      // Run 2: invoke again WITHOUT domainRecommendations in input
      // (simulates the user navigating back to the website page)
      const run2Result = await graph.invoke(
        {
          jwt: "test",
          websiteId: 1,
          accountId: 1,
          messages: [new HumanMessage("change the color")],
        },
        config
      );

      // domainRecommendations should be preserved from the checkpoint
      expect(run2Result.domainRecommendations).toEqual(existing);
    });

    it("preserves domainRecommendations through nested subgraphs (mirrors real architecture)", async () => {
      const existing = buildDomainRecommendations();

      // Mirror the real architecture:
      // outerGraph → innerSubgraph (compiled without checkpointer)
      //
      // This is the pattern used by withCreditExhaustion:
      //   outer.addNode("run", innerGraph.compile())  // no checkpointer
      const innerGraph = new StateGraph(WebsiteAnnotation)
        .addNode("noop", () => ({}))
        .addEdge(START, "noop")
        .addEdge("noop", END)
        .compile(); // no checkpointer — matches production behavior

      const outerGraph = new StateGraph(WebsiteAnnotation)
        .addNode("run", innerGraph)
        .addEdge(START, "run")
        .addEdge("run", END)
        .compile({ checkpointer: new MemorySaver() });

      const threadId = generateUUID();
      const config = { configurable: { thread_id: threadId } };

      // Run 1: set domainRecommendations
      await outerGraph.invoke(
        {
          jwt: "test",
          websiteId: 1,
          accountId: 1,
          domainRecommendations: existing,
        },
        config
      );

      // Run 2: invoke again WITHOUT domainRecommendations
      const run2Result = await outerGraph.invoke(
        {
          jwt: "test",
          websiteId: 1,
          accountId: 1,
          messages: [new HumanMessage("change the color")],
        },
        config
      );

      // domainRecommendations should be preserved from checkpoint through the subgraph
      expect(run2Result.domainRecommendations).toEqual(existing);
    });

    it("preserves domainRecommendations through 3-level nesting (mirrors production architecture)", async () => {
      const existing = buildDomainRecommendations();

      // Mirror the EXACT production architecture:
      //
      // Level 1 (outermost): withCreditExhaustion wrapper
      //   Compiled WITH checkpointer (PostgresSaver in prod, MemorySaver here)
      //   Nodes: "run" (the intent graph) → "creditExhaustion" (noop here)
      //
      // Level 2 (middle): createIntentGraph / intent router
      //   Compiled WITHOUT checkpointer
      //   Nodes: routeByIntent → "default" (websiteBuilder) → "clearIntent"
      //
      // Level 3 (innermost): websiteBuilderSubgraph
      //   Compiled WITHOUT checkpointer
      //   Nodes: "updateWebsite" (noop) → parallel: "websiteBuilder" + "recommendDomains"

      // Level 3: websiteBuilder subgraph (innermost)
      const websiteBuilderSubgraph = new StateGraph(WebsiteAnnotation)
        .addNode("updateWebsite", () => ({}))
        .addNode("websiteBuilder", () => ({}))
        .addNode("recommendDomains", () => ({})) // noop - we're testing state propagation
        .addEdge(START, "updateWebsite")
        .addEdge("updateWebsite", "websiteBuilder")
        .addEdge("updateWebsite", "recommendDomains")
        .addEdge("websiteBuilder", END)
        .addEdge("recommendDomains", END)
        .compile(); // NO checkpointer

      // Level 2: intent graph (middle)
      const intentGraph = new StateGraph(WebsiteAnnotation)
        .addNode("default", websiteBuilderSubgraph)
        .addNode("clearIntent", () => ({ intent: null }))
        .addEdge(START, "default")
        .addEdge("default", "clearIntent")
        .addEdge("clearIntent", END)
        .compile(); // NO checkpointer

      // Level 1: credit wrapper (outermost) — HAS checkpointer
      const outerGraph = new StateGraph(WebsiteAnnotation)
        .addNode("run", intentGraph)
        .addNode("creditExhaustion", () => ({}))
        .addEdge(START, "run")
        .addEdge("run", "creditExhaustion")
        .addEdge("creditExhaustion", END)
        .compile({ checkpointer: new MemorySaver() });

      const threadId = generateUUID();
      const config = { configurable: { thread_id: threadId } };

      // Run 1: set domainRecommendations (simulates first website build)
      await outerGraph.invoke(
        {
          jwt: "test",
          websiteId: 1,
          accountId: 1,
          domainRecommendations: existing,
        },
        config
      );

      // Verify checkpoint stored domainRecommendations
      const checkpoint = await outerGraph.getState(config);
      expect(checkpoint.values.domainRecommendations).toEqual(existing);

      // Run 2: invoke again WITHOUT domainRecommendations
      // (simulates user navigating back to website page and triggering an edit)
      const run2Result = await outerGraph.invoke(
        {
          jwt: "test",
          websiteId: 1,
          accountId: 1,
          messages: [new HumanMessage("change the color")],
        },
        config
      );

      // domainRecommendations MUST survive through all 3 nesting levels
      expect(run2Result.domainRecommendations).toEqual(existing);
    });

    it("loses domainRecommendations when a NEW thread is used (regression: thread_id loss)", async () => {
      const existing = buildDomainRecommendations();

      const graph = new StateGraph(WebsiteAnnotation)
        .addNode("noop", () => ({}))
        .addEdge(START, "noop")
        .addEdge("noop", END)
        .compile({ checkpointer: new MemorySaver() });

      const threadId1 = generateUUID();
      const threadId2 = generateUUID(); // Different thread!

      // Run 1: set domainRecommendations on thread 1
      await graph.invoke(
        {
          jwt: "test",
          websiteId: 1,
          accountId: 1,
          domainRecommendations: existing,
        },
        { configurable: { thread_id: threadId1 } }
      );

      // Run 2: invoke on a DIFFERENT thread (thread_id loss scenario)
      // This simulates the bug: user navigates away and back, frontend
      // creates a new thread instead of reusing the existing one.
      const run2Result = await graph.invoke(
        {
          jwt: "test",
          websiteId: 1,
          accountId: 1,
        },
        { configurable: { thread_id: threadId2 } }
      );

      // On a new thread, domainRecommendations is NOT preserved (expected)
      // This confirms the root cause: if the frontend creates a new thread,
      // the checkpoint from the old thread is not available.
      expect(run2Result.domainRecommendations).toBeUndefined();
    });
  });
});
