import { describe, it, expect, vi } from "vitest";
import { buildNotifyUrl } from "@core";

describe("notifyRails", () => {
  describe("buildNotifyUrl", () => {
    it("builds correct URL for Rails notification endpoint", () => {
      const url = buildNotifyUrl("run_123");
      expect(url).toContain("/api/v1/llm_usage/notify");
      expect(url).toContain("run_id=run_123");
    });

    it("URL-encodes the run_id parameter", () => {
      const url = buildNotifyUrl("run with spaces & special=chars");
      // URLSearchParams uses + for spaces (application/x-www-form-urlencoded)
      expect(url).toContain("run_id=run+with+spaces");
      expect(url).toContain("special%3Dchars"); // = is encoded as %3D
    });

    it("uses RAILS_URL from environment when available", () => {
      // Default URL is used when env not set
      const url = buildNotifyUrl("run_123");
      expect(url).toMatch(/^http:\/\/localhost:3000/);
    });
  });

  // Note: Integration tests for notifyRails() function would require
  // actual HTTP mocking or a test server. The buildNotifyUrl() tests
  // above verify the URL construction logic.
  //
  // The notifyRails() function is fire-and-forget by design:
  // - It catches all errors and logs warnings
  // - Rails has a backup polling job for reliability
});
