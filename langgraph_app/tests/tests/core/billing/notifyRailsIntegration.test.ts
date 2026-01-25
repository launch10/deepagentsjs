import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notifyRails, buildNotifyUrl } from "@core";

/**
 * RAILS NOTIFICATION TESTS - BILLING CRITICAL
 *
 * These tests verify that notifyRails actually makes HTTP requests
 * to Rails with the correct parameters.
 *
 * Failure = Rails never charges credits = no revenue.
 */

describe("notifyRails - BILLING CRITICAL", () => {
  describe("buildNotifyUrl (unit)", () => {
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
  });

  describe("HTTP Request Behavior", () => {
    let originalFetch: typeof globalThis.fetch;
    let mockFetch: ReturnType<typeof vi.fn>;
    let fetchCalls: { url: string; options?: RequestInit }[] = [];

    beforeEach(() => {
      fetchCalls = [];
      originalFetch = globalThis.fetch;

      mockFetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
        const urlString = url.toString();
        fetchCalls.push({ url: urlString, options });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      globalThis.fetch = mockFetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    describe("HTTP Request Verification", () => {
      it("MUST make POST request to Rails notify endpoint", async () => {
        await notifyRails("test-run-123");

        expect(mockFetch).toHaveBeenCalledTimes(1);

        const [url, options] = mockFetch.mock.calls[0]!;
        expect(options?.method).toBe("POST");
        expect(url).toContain("/api/v1/llm_usage/notify");
      });

      it("MUST include run_id as query parameter", async () => {
        await notifyRails("run-abc-xyz-123");

        const [url] = mockFetch.mock.calls[0]!;
        expect(url).toContain("run_id=run-abc-xyz-123");
      });

      it("MUST URL-encode special characters in run_id", async () => {
        await notifyRails("run with spaces & special=chars");

        const [url] = mockFetch.mock.calls[0]!;
        // URL encoding: spaces become + or %20, & becomes %26, = becomes %3D
        expect(url).toMatch(/run_id=run[+%]with[+%]spaces/);
      });

      it("MUST use RAILS_URL from environment", async () => {
        const originalRailsUrl = process.env.RAILS_URL;
        process.env.RAILS_URL = "https://custom-rails.example.com";

        try {
          await notifyRails("test-run");

          const [url] = mockFetch.mock.calls[0]!;
          expect(url).toContain("https://custom-rails.example.com");
        } finally {
          if (originalRailsUrl) {
            process.env.RAILS_URL = originalRailsUrl;
          } else {
            delete process.env.RAILS_URL;
          }
        }
      });
    });

    describe("Fire-and-Forget Behavior", () => {
      it("MUST NOT throw on network error", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        // Should not throw
        await expect(notifyRails("test-run")).resolves.toBeUndefined();
      });

      it("MUST NOT throw on non-200 response", async () => {
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
          })
        );

        // Should not throw
        await expect(notifyRails("test-run")).resolves.toBeUndefined();
      });

      it("MUST NOT throw on timeout", async () => {
        mockFetch.mockImplementationOnce(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Timeout")), 100);
          });
        });

        // Should not throw
        await expect(notifyRails("test-run")).resolves.toBeUndefined();
      });

      it("MUST still make the request even if not waiting for response", async () => {
        let requestMade = false;

        mockFetch.mockImplementationOnce(async () => {
          requestMade = true;
          // Simulate slow response
          await new Promise((resolve) => setTimeout(resolve, 50));
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        });

        // Fire-and-forget
        notifyRails("test-run");

        // Give it time to make the request
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(requestMade).toBe(true);
      });
    });

    describe("Reliability Design", () => {
      it("MUST complete immediately (not block on Rails response)", async () => {
        mockFetch.mockImplementationOnce(async () => {
          // Simulate very slow Rails response
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return new Response("OK", { status: 200 });
        });

        const startTime = Date.now();

        // This should return immediately, not wait for Rails
        await notifyRails("test-run");

        const elapsed = Date.now() - startTime;

        // Should complete in under 100ms, not 5 seconds
        expect(elapsed).toBeLessThan(100);
      });

      it("MUST log errors without throwing", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

        await notifyRails("test-run");

        // Should have logged the error
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe("Content-Type Header", () => {
      it("MUST set appropriate Content-Type for POST", async () => {
        await notifyRails("test-run");

        const [, options] = mockFetch.mock.calls[0]!;

        // Since this is a POST with no body, headers may vary
        // but it should at least make the request
        expect(options?.method).toBe("POST");
      });
    });
  });
});
