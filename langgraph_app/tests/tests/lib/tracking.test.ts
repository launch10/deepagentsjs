/**
 * Unit tests for L10 lead capture library.
 *
 * Note: import.meta.env is compile-time replaced by Vite, so we can't fully mock it.
 * These tests verify the API shape and error handling. Full integration tests
 * should run in a Vite environment with real env vars.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { L10, LeadError } from "../../../../rails_app/templates/default/src/lib/tracking";

describe("L10", () => {
  describe("LeadError", () => {
    it("is an Error subclass", () => {
      const error = new LeadError("test message");
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("LeadError");
      expect(error.message).toBe("test message");
    });

    it("has proper stack trace", () => {
      const error = new LeadError("test");
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("LeadError");
    });
  });

  describe("createLead", () => {
    let mockFetch: ReturnType<typeof vi.fn>;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      mockFetch = vi.fn();
      originalFetch = global.fetch;
      global.fetch = mockFetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it("is an async function", () => {
      expect(typeof L10.createLead).toBe("function");
      // Returns a promise
      const result = L10.createLead("test@example.com");
      expect(result).toBeInstanceOf(Promise);
      // Catch to prevent unhandled rejection (will fail due to missing env vars)
      result.catch(() => {});
    });

    it("throws LeadError when env vars are missing", async () => {
      // In test environment, import.meta.env.VITE_* are undefined
      await expect(L10.createLead("test@example.com")).rejects.toThrow(LeadError);
      await expect(L10.createLead("test@example.com")).rejects.toThrow("Configuration error");
    });

    it("accepts email and optional options", async () => {
      // Verify the function signature accepts these parameters
      // (will still fail due to missing env vars, but tests the interface)
      const promise1 = L10.createLead("test@example.com");
      const promise2 = L10.createLead("test@example.com", { value: 99 });
      const promise3 = L10.createLead("test@example.com", { name: "John" });
      const promise4 = L10.createLead("test@example.com", { value: 99, name: "John" });

      // All should be promises (will reject due to missing env)
      expect(promise1).toBeInstanceOf(Promise);
      expect(promise2).toBeInstanceOf(Promise);
      expect(promise3).toBeInstanceOf(Promise);
      expect(promise4).toBeInstanceOf(Promise);

      // Catch all to prevent unhandled rejections
      await Promise.allSettled([promise1, promise2, promise3, promise4]);
    });

    it("does not call fetch when env vars are missing", async () => {
      try {
        await L10.createLead("test@example.com");
      } catch {
        // Expected to throw
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
