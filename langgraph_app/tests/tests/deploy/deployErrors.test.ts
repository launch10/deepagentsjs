import { describe, it, expect } from "vitest";
import { Deploy } from "@types";

describe("Deploy Error Mapping", () => {
  describe("getDeployError", () => {
    it("maps timeout errors to user-friendly message", () => {
      const error = Deploy.getDeployError(
        'Task "DeployingWebsite" timed out waiting for external result'
      );
      expect(error.title).toBe("Deployment timed out");
      expect(error.canRetry).toBe(true);
    });

    it("maps website deploy failures", () => {
      const error = Deploy.getDeployError("Website deploy 42 failed");
      expect(error.title).toBe("Website deployment failed");
      expect(error.canRetry).toBe(true);
    });

    it("maps campaign failures", () => {
      const error = Deploy.getDeployError("Campaign deploy failed: invalid budget");
      expect(error.title).toBe("Campaign deployment failed");
      expect(error.canRetry).toBe(true);
    });

    it("maps Sidekiq exhausted retries", () => {
      const error = Deploy.getDeployError("Sidekiq retries exhausted: connection refused");
      expect(error.title).toBe("Deployment failed after multiple attempts");
      expect(error.canRetry).toBe(true);
    });

    it("maps Google OAuth errors", () => {
      const error = Deploy.getDeployError("Google OAuth callback failed");
      expect(error.title).toBe("Google connection issue");
      expect(error.canRetry).toBe(true);
    });

    it("maps payment errors", () => {
      const error = Deploy.getDeployError("Payment verification failed");
      expect(error.title).toBe("Payment issue");
      expect(error.canRetry).toBe(true);
    });

    it("maps rate limit errors", () => {
      const error = Deploy.getDeployError("Rate limit exceeded: 429");
      expect(error.title).toBe("Too many requests");
      expect(error.canRetry).toBe(true);
    });

    it("maps network errors", () => {
      const error = Deploy.getDeployError("ECONNREFUSED: connection refused");
      expect(error.title).toBe("Connection issue");
      expect(error.canRetry).toBe(true);
    });

    it("returns default error for unknown messages", () => {
      const error = Deploy.getDeployError("some totally unknown error xyz");
      expect(error.title).toBe("Deployment failed");
      expect(error.message).toContain("unexpected");
      expect(error.canRetry).toBe(true);
    });

    it("returns default error for undefined input", () => {
      const error = Deploy.getDeployError(undefined);
      expect(error.title).toBe("Deployment failed");
      expect(error.canRetry).toBe(true);
    });

    it("returns default error for null input", () => {
      const error = Deploy.getDeployError(null);
      expect(error.title).toBe("Deployment failed");
      expect(error.canRetry).toBe(true);
    });
  });
});
