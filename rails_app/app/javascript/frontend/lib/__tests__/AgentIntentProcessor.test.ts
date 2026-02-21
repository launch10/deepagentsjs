import { describe, it, expect, vi } from "vitest";
import { AgentIntentProcessor } from "../AgentIntentProcessor";
import type { AgentIntent } from "@shared";

function makeIntent(type: string, createdAt?: string): AgentIntent {
  return {
    type,
    payload: {},
    createdAt: createdAt ?? new Date().toISOString(),
  };
}

describe("AgentIntentProcessor", () => {
  describe("process", () => {
    it("fires handler for matching intent type", () => {
      const processor = new AgentIntentProcessor();
      const handler = vi.fn();

      processor.on("navigate", handler);
      const intent = makeIntent("navigate");
      processor.process([intent]);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(intent);
    });

    it("does not fire handler for non-matching type", () => {
      const processor = new AgentIntentProcessor();
      const handler = vi.fn();

      processor.on("navigate", handler);
      processor.process([makeIntent("brand_updated")]);

      expect(handler).not.toHaveBeenCalled();
    });

    it("fires each intent exactly once (process-once semantics)", () => {
      const processor = new AgentIntentProcessor();
      const handler = vi.fn();

      processor.on("navigate", handler);
      const intent = makeIntent("navigate", "2025-01-01T00:00:00.000Z");

      processor.process([intent]);
      processor.process([intent]);
      processor.process([intent]);

      expect(handler).toHaveBeenCalledOnce();
    });

    it("processes new intents even if old ones are in the array", () => {
      const processor = new AgentIntentProcessor();
      const handler = vi.fn();

      processor.on("navigate", handler);
      const old = makeIntent("navigate", "2025-01-01T00:00:00.000Z");
      const fresh = makeIntent("navigate", "2025-01-02T00:00:00.000Z");

      processor.process([old]);
      processor.process([old, fresh]);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, old);
      expect(handler).toHaveBeenNthCalledWith(2, fresh);
    });

    it("fires wildcard (*) listeners for any intent type", () => {
      const processor = new AgentIntentProcessor();
      const handler = vi.fn();

      processor.on("*", handler);

      const nav = makeIntent("navigate", "t1");
      const brand = makeIntent("brand_updated", "t2");
      processor.process([nav, brand]);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(nav);
      expect(handler).toHaveBeenCalledWith(brand);
    });

    it("fires both type-specific and wildcard listeners", () => {
      const processor = new AgentIntentProcessor();
      const specific = vi.fn();
      const wildcard = vi.fn();

      processor.on("navigate", specific);
      processor.on("*", wildcard);

      const intent = makeIntent("navigate");
      processor.process([intent]);

      expect(specific).toHaveBeenCalledOnce();
      expect(wildcard).toHaveBeenCalledOnce();
    });

    it("supports multiple handlers for the same type", () => {
      const processor = new AgentIntentProcessor();
      const h1 = vi.fn();
      const h2 = vi.fn();

      processor.on("navigate", h1);
      processor.on("navigate", h2);

      const intent = makeIntent("navigate");
      processor.process([intent]);

      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });
  });

  describe("on (subscribe/unsubscribe)", () => {
    it("returns an unsubscribe function", () => {
      const processor = new AgentIntentProcessor();
      const handler = vi.fn();

      const unsub = processor.on("navigate", handler);
      unsub();

      processor.process([makeIntent("navigate")]);
      expect(handler).not.toHaveBeenCalled();
    });

    it("only removes the specific handler on unsubscribe", () => {
      const processor = new AgentIntentProcessor();
      const keep = vi.fn();
      const remove = vi.fn();

      processor.on("navigate", keep);
      const unsub = processor.on("navigate", remove);
      unsub();

      processor.process([makeIntent("navigate")]);
      expect(keep).toHaveBeenCalledOnce();
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe("markProcessed", () => {
    it("marks intents as processed without firing handlers", () => {
      const processor = new AgentIntentProcessor();
      const handler = vi.fn();

      processor.on("navigate", handler);
      const intent = makeIntent("navigate", "stale-timestamp");

      processor.markProcessed([intent]);
      processor.process([intent]);

      expect(handler).not.toHaveBeenCalled();
    });

    it("still fires handlers for new intents after marking old ones", () => {
      const processor = new AgentIntentProcessor();
      const handler = vi.fn();

      processor.on("navigate", handler);
      const stale = makeIntent("navigate", "stale");
      const fresh = makeIntent("navigate", "fresh");

      processor.markProcessed([stale]);
      processor.process([stale, fresh]);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(fresh);
    });
  });
});
