import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { AgentIntentProcessor } from "@lib/AgentIntentProcessor";
import { subscribeToAgentIntent } from "../useAgentIntent";
import type { AgentIntent } from "@shared";

// Fresh mock chat per test — avoids WeakMap sharing across tests
let mockChat: any;

function createMockChat() {
  return {
    langgraphState: {} as Record<string, unknown>,
    "~registerStateKeyCallback": vi.fn(() => () => {}),
  };
}

vi.mock("@components/shared/chat/ChatContext", () => ({
  useChatFromContext: () => mockChat,
}));

function makeIntent(type: string, createdAt?: string): AgentIntent {
  return {
    type,
    payload: {},
    createdAt: createdAt ?? new Date().toISOString(),
  };
}

describe("subscribeToAgentIntent", () => {
  beforeEach(() => {
    mockChat = createMockChat();
  });

  it("subscribes to intents via the processor", () => {
    const handler = vi.fn();

    renderHook(() => subscribeToAgentIntent("navigate", handler));

    const processor = AgentIntentProcessor.forChat(mockChat);
    const intent = makeIntent("navigate");
    processor.process([intent]);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(intent);
  });

  it("unsubscribes on unmount", () => {
    const handler = vi.fn();

    const { unmount } = renderHook(() => subscribeToAgentIntent("navigate", handler));

    unmount();

    const processor = AgentIntentProcessor.forChat(mockChat);
    processor.process([makeIntent("navigate")]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("always calls the latest handler (no useCallback needed)", () => {
    const calls: string[] = [];

    const { rerender } = renderHook(
      ({ version }: { version: string }) =>
        subscribeToAgentIntent("navigate", () => calls.push(version)),
      { initialProps: { version: "v1" } }
    );

    // Rerender with a new handler
    rerender({ version: "v2" });

    const processor = AgentIntentProcessor.forChat(mockChat);
    processor.process([makeIntent("navigate")]);
    expect(calls).toEqual(["v2"]);
  });

  it("does not create duplicate subscriptions on rerender", () => {
    const handler = vi.fn();

    const { rerender } = renderHook(() => subscribeToAgentIntent("navigate", handler));

    rerender();
    rerender();

    const processor = AgentIntentProcessor.forChat(mockChat);
    processor.process([makeIntent("navigate")]);
    // Should fire once, not three times
    expect(handler).toHaveBeenCalledOnce();
  });
});
