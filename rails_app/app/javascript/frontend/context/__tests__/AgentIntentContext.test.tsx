import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { AgentIntentProcessor } from "@lib/AgentIntentProcessor";
import {
  AgentIntentProvider,
  useAgentIntentProcessor,
  subscribeToAgentIntent,
} from "../AgentIntentContext";
import type { AgentIntent } from "@shared";

function makeIntent(type: string, createdAt?: string): AgentIntent {
  return {
    type,
    payload: {},
    createdAt: createdAt ?? new Date().toISOString(),
  };
}

function createWrapper(processor: AgentIntentProcessor) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AgentIntentProvider value={processor}>{children}</AgentIntentProvider>
    );
  };
}

describe("AgentIntentContext", () => {
  describe("useAgentIntentProcessor", () => {
    it("returns the processor from context", () => {
      const processor = new AgentIntentProcessor();
      const { result } = renderHook(() => useAgentIntentProcessor(), {
        wrapper: createWrapper(processor),
      });

      expect(result.current).toBe(processor);
    });

    it("throws when used outside provider", () => {
      expect(() => {
        renderHook(() => useAgentIntentProcessor());
      }).toThrow("useAgentIntentProcessor must be used within Chat.Root");
    });
  });

  describe("subscribeToAgentIntent", () => {
    it("subscribes to intents via the processor", () => {
      const processor = new AgentIntentProcessor();
      const handler = vi.fn();

      renderHook(() => subscribeToAgentIntent("navigate", handler), {
        wrapper: createWrapper(processor),
      });

      const intent = makeIntent("navigate");
      processor.process([intent]);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(intent);
    });

    it("unsubscribes on unmount", () => {
      const processor = new AgentIntentProcessor();
      const handler = vi.fn();

      const { unmount } = renderHook(
        () => subscribeToAgentIntent("navigate", handler),
        { wrapper: createWrapper(processor) },
      );

      unmount();

      processor.process([makeIntent("navigate")]);
      expect(handler).not.toHaveBeenCalled();
    });

    it("always calls the latest handler (no useCallback needed)", () => {
      const processor = new AgentIntentProcessor();
      const calls: string[] = [];

      const { rerender } = renderHook(
        ({ version }: { version: string }) =>
          subscribeToAgentIntent("navigate", () => calls.push(version)),
        {
          wrapper: createWrapper(processor),
          initialProps: { version: "v1" },
        },
      );

      // Rerender with a new handler
      rerender({ version: "v2" });

      processor.process([makeIntent("navigate")]);
      expect(calls).toEqual(["v2"]);
    });

    it("does not create duplicate subscriptions on rerender", () => {
      const processor = new AgentIntentProcessor();
      const handler = vi.fn();

      const { rerender } = renderHook(
        () => subscribeToAgentIntent("navigate", handler),
        { wrapper: createWrapper(processor) },
      );

      rerender();
      rerender();

      processor.process([makeIntent("navigate")]);
      // Should fire once, not three times
      expect(handler).toHaveBeenCalledOnce();
    });
  });
});
