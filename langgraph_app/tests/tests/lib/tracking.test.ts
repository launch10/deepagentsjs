/**
 * Unit tests for L10 conversion tracking library.
 *
 * Tests the actual tracking.ts from the template.
 * This is the single source of truth that gets deployed to user pages.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Import the real implementation from the template
// This ensures we're testing what actually gets deployed
import { L10 } from "../../../../rails_app/templates/default/src/lib/tracking";

declare global {
  var window: Window & typeof globalThis;
}

describe("L10 Conversion Tracking", () => {
  let mockGtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGtag = vi.fn();

    // Mock window and gtag
    global.window = {
      gtag: mockGtag,
      L10_CONFIG: undefined,
      L10: L10,
    } as unknown as Window & typeof globalThis;

    // Reset L10 config
    L10._config = {};
  });

  describe("conversion()", () => {
    it("fires gtag with correct send_to format", () => {
      L10.init({ googleAdsId: "AW-123456789" });

      L10.conversion({ label: "signup" });

      expect(mockGtag).toHaveBeenCalledWith("event", "conversion", {
        send_to: "AW-123456789/signup",
        value: undefined,
        currency: "USD",
      });
    });

    it("looks up semantic label from conversionLabels config", () => {
      L10.init({
        googleAdsId: "AW-123456789",
        conversionLabels: {
          signup: "abc123xyz",
          lead: "def456uvw",
        },
      });

      L10.conversion({ label: "signup" });

      expect(mockGtag).toHaveBeenCalledWith("event", "conversion", {
        send_to: "AW-123456789/abc123xyz",
        value: undefined,
        currency: "USD",
      });
    });

    it("passes value and currency correctly for ROAS tracking", () => {
      L10.init({ googleAdsId: "AW-123456789" });

      L10.conversion({ label: "signup", value: 99, currency: "USD" });

      expect(mockGtag).toHaveBeenCalledWith("event", "conversion", {
        send_to: "AW-123456789/signup",
        value: 99,
        currency: "USD",
      });
    });

    it("defaults currency to USD when not specified", () => {
      L10.init({ googleAdsId: "AW-123456789" });

      L10.conversion({ label: "signup", value: 50 });

      expect(mockGtag).toHaveBeenCalledWith("event", "conversion", {
        send_to: "AW-123456789/signup",
        value: 50,
        currency: "USD",
      });
    });

    it("does not call gtag when googleAdsId is missing", () => {
      L10.init({});

      L10.conversion({ label: "signup" });

      expect(mockGtag).not.toHaveBeenCalled();
    });

    it("does not call gtag when window.gtag is undefined", () => {
      global.window = { L10_CONFIG: undefined } as unknown as Window & typeof globalThis;

      L10.init({ googleAdsId: "AW-123456789" });
      L10.conversion({ label: "signup" });

      expect(mockGtag).not.toHaveBeenCalled();
    });
  });

  describe("init()", () => {
    it("merges window.L10_CONFIG with provided config", () => {
      global.window = {
        gtag: mockGtag,
        L10_CONFIG: {
          googleAdsId: "AW-111111111",
          conversionLabels: { signup: "label1" },
        },
        L10: L10,
      } as unknown as Window & typeof globalThis;

      L10.init({ conversionLabels: { lead: "label2" } });

      L10.conversion({ label: "signup" });

      expect(mockGtag).toHaveBeenCalledWith("event", "conversion", {
        send_to: "AW-111111111/signup",
        value: undefined,
        currency: "USD",
      });
    });
  });
});
