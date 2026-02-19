import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { AgentIntent } from "@shared";

// Mock dependencies before importing the hook
const mockWorkflowNavigate = vi.fn();
vi.mock("@context/WorkflowProvider", () => ({
  useWorkflowOptional: () => mockWorkflowNavigate,
  selectNavigate: (s: unknown) => s,
}));

// Mock useChatSelector — returns values from a mutable state object
const mockState: {
  agentIntents?: AgentIntent[];
  status: string;
} = { agentIntents: undefined, status: "idle" };

vi.mock("langgraph-ai-sdk-react", () => ({
  useChatSelector: (
    _chat: unknown,
    selector: (s: { state: typeof mockState; status: string }) => unknown,
  ) => {
    return selector({ state: mockState, status: mockState.status });
  },
}));

import { useAgentIntentSetup } from "../useAgentIntentSetup";
import { AgentIntentProcessor } from "@lib/AgentIntentProcessor";

function makeFakeChat() {
  return {} as Parameters<typeof useAgentIntentSetup>[0];
}

function makeIntent(type: string, createdAt?: string): AgentIntent {
  return {
    type,
    payload: type === "navigate" ? { page: "website" } : {},
    createdAt: createdAt ?? new Date().toISOString(),
  };
}

describe("useAgentIntentSetup", () => {
  beforeEach(() => {
    mockState.agentIntents = undefined;
    mockState.status = "idle";
    mockWorkflowNavigate.mockReset();
  });

  it("returns an AgentIntentProcessor", () => {
    const { result } = renderHook(() => useAgentIntentSetup(makeFakeChat()));
    expect(result.current).toBeInstanceOf(AgentIntentProcessor);
  });

  it("returns the same processor across re-renders (stable identity)", () => {
    const { result, rerender } = renderHook(() =>
      useAgentIntentSetup(makeFakeChat()),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("marks initial intents as processed (revisit guard)", () => {
    const staleIntent = makeIntent("navigate", "stale");
    mockState.agentIntents = [staleIntent];
    mockState.status = "idle";

    renderHook(() => useAgentIntentSetup(makeFakeChat()));

    // Navigate should NOT have been called — initial intents are marked, not processed
    expect(mockWorkflowNavigate).not.toHaveBeenCalled();
  });

  it("processes new intents after initial capture", () => {
    // Start with one stale intent
    const staleIntent = makeIntent("navigate", "stale");
    mockState.agentIntents = [staleIntent];
    mockState.status = "idle";

    const { rerender } = renderHook(() =>
      useAgentIntentSetup(makeFakeChat()),
    );

    // New intent arrives, not streaming
    const freshIntent = makeIntent("navigate", "fresh");
    mockState.agentIntents = [staleIntent, freshIntent];
    rerender();

    expect(mockWorkflowNavigate).toHaveBeenCalledOnce();
    expect(mockWorkflowNavigate).toHaveBeenCalledWith("website", null);
  });

  it("processes intents immediately during streaming (replace semantics — intents are transient)", () => {
    mockState.agentIntents = undefined;
    mockState.status = "idle";

    const { rerender } = renderHook(() =>
      useAgentIntentSetup(makeFakeChat()),
    );

    // Intent arrives during streaming — process immediately since
    // agentIntents uses replace semantics and will be gone by next node
    mockState.agentIntents = [makeIntent("navigate", "t1")];
    mockState.status = "streaming";
    rerender();

    expect(mockWorkflowNavigate).toHaveBeenCalledOnce();
  });

  it("deduplicates — same intent is not processed twice even if state re-emits it", () => {
    mockState.agentIntents = undefined;
    mockState.status = "idle";

    const { rerender } = renderHook(() =>
      useAgentIntentSetup(makeFakeChat()),
    );

    // Intent arrives during streaming
    const intent = makeIntent("navigate", "t1");
    mockState.agentIntents = [intent];
    mockState.status = "streaming";
    rerender();

    expect(mockWorkflowNavigate).toHaveBeenCalledOnce();

    // Same intent still in state after streaming ends — should NOT re-fire
    mockState.status = "idle";
    rerender();

    expect(mockWorkflowNavigate).toHaveBeenCalledOnce();
  });

  it("allows component-level subscriptions via the returned processor", () => {
    mockState.agentIntents = undefined;
    mockState.status = "idle";

    const { result, rerender } = renderHook(() =>
      useAgentIntentSetup(makeFakeChat()),
    );

    const brandHandler = vi.fn();
    result.current.on("brand_updated", brandHandler);

    // Brand intent arrives
    mockState.agentIntents = [makeIntent("brand_updated", "b1")];
    rerender();

    expect(brandHandler).toHaveBeenCalledOnce();
    // Navigate should NOT have fired for brand_updated
    expect(mockWorkflowNavigate).not.toHaveBeenCalled();
  });
});
