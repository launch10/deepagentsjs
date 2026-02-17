import { describe, it, expect } from "vitest";
import { Deploy } from "@types";

describe("Deploy Error Classification", () => {
  describe("cross-cutting patterns (apply regardless of node)", () => {
    it("maps timeout errors", () => {
      const error = Deploy.getDeployError(
        'Task "DeployingWebsite" timed out waiting for external result',
        "DeployingWebsite"
      );
      expect(error.title).toBe("Deployment timed out");
      expect(error.canRetry).toBe(true);
      expect(error.needsSupport).toBe(false);
    });

    it("maps rate limit errors", () => {
      const error = Deploy.getDeployError("Rate limit exceeded: 429", "DeployingCampaign");
      expect(error.title).toBe("Too many requests");
      expect(error.canRetry).toBe(true);
    });

    it("maps network errors", () => {
      const error = Deploy.getDeployError("ECONNREFUSED: connection refused", "AddingAnalytics");
      expect(error.title).toBe("Connection issue");
      expect(error.canRetry).toBe(true);
    });

    it("maps Google Ads policy violation errors", () => {
      const error = Deploy.getDeployError(
        'Step create_ads did not complete successfully. Diagnostic: [{:entity=>:ad_group_ad, :status=>:error, :error=>"GoogleAdsError: policy_finding: PROHIBITED"}]',
        "DeployingCampaign"
      );
      expect(error.title).toBe("Ad rejected by Google");
      expect(error.canRetry).toBe(true);
      expect(error.needsSupport).toBe(true);
    });

    it("maps PROHIBITED policy errors", () => {
      const error = Deploy.getDeployError(
        "Sidekiq retries exhausted: Step create_ads did not complete successfully. Diagnostic: PROHIBITED",
        "DeployingCampaign"
      );
      expect(error.title).toBe("Ad rejected by Google");
    });

    it("maps general GoogleAdsError errors", () => {
      const error = Deploy.getDeployError(
        "Step create_campaign did not complete successfully. Diagnostic: GoogleAdsError: INVALID_ARGUMENT",
        "DeployingCampaign"
      );
      expect(error.title).toBe("Google Ads error");
      expect(error.canRetry).toBe(true);
      expect(error.needsSupport).toBe(true);
    });

    it("policy errors take priority over sidekiq retries exhausted", () => {
      const error = Deploy.getDeployError(
        "Sidekiq retries exhausted: Step create_ads did not complete successfully. Diagnostic: policy_finding: PROHIBITED",
        "DeployingCampaign"
      );
      expect(error.title).toBe("Ad rejected by Google");
      expect(error.title).not.toBe("Deployment failed after multiple attempts");
    });

    it("GoogleAdsError takes priority over sidekiq retries exhausted", () => {
      const error = Deploy.getDeployError(
        "Sidekiq retries exhausted: Step create_campaign did not complete successfully. Diagnostic: GoogleAdsError: INVALID_ARGUMENT",
        "DeployingCampaign"
      );
      expect(error.title).toBe("Google Ads error");
      expect(error.title).not.toBe("Deployment failed after multiple attempts");
    });

    it("maps Sidekiq exhausted retries", () => {
      const error = Deploy.getDeployError(
        "Sidekiq retries exhausted: connection refused",
        "DeployingWebsite"
      );
      expect(error.title).toBe("Deployment failed after multiple attempts");
      expect(error.needsSupport).toBe(true);
    });

    it("cross-cutting patterns take priority over node defaults", () => {
      // Even though node is DeployingWebsite, a timeout should show "timed out"
      const error = Deploy.getDeployError("Something timed out", "DeployingWebsite");
      expect(error.title).toBe("Deployment timed out");
    });
  });

  describe("node-based classification", () => {
    it("DeployingWebsite failure shows website error", () => {
      const error = Deploy.getDeployError("Some Rails 500 HTML error page...", "DeployingWebsite");
      expect(error.title).toBe("Website deployment failed");
      expect(error.needsSupport).toBe(true);
    });

    it("DeployingCampaign failure shows campaign error", () => {
      const error = Deploy.getDeployError("Some unknown error", "DeployingCampaign");
      expect(error.title).toBe("Campaign deployment failed");
      expect(error.needsSupport).toBe(true);
    });

    it("EnablingCampaign failure shows activation error", () => {
      const error = Deploy.getDeployError("Some unknown error", "EnablingCampaign");
      expect(error.title).toBe("Campaign activation failed");
      expect(error.needsSupport).toBe(true);
    });

    it("ConnectingGoogle failure shows Google connection error", () => {
      const error = Deploy.getDeployError("Some random error", "ConnectingGoogle");
      expect(error.title).toBe("Google connection issue");
      expect(error.needsSupport).toBe(false);
    });

    it("VerifyingGoogle failure shows Google verification error", () => {
      const error = Deploy.getDeployError("Some random error", "VerifyingGoogle");
      expect(error.title).toBe("Google verification issue");
      expect(error.needsSupport).toBe(false);
    });

    it("CheckingBilling failure shows payment error", () => {
      const error = Deploy.getDeployError("Some random error", "CheckingBilling");
      expect(error.title).toBe("Payment issue");
      expect(error.needsSupport).toBe(false);
    });

    it("AddingAnalytics failure shows analytics error", () => {
      const error = Deploy.getDeployError("Some random error", "AddingAnalytics");
      expect(error.title).toBe("Analytics setup failed");
      expect(error.needsSupport).toBe(false);
    });

    it("OptimizingSEO failure shows SEO error", () => {
      const error = Deploy.getDeployError("Some random error", "OptimizingSEO");
      expect(error.title).toBe("SEO optimization failed");
      expect(error.needsSupport).toBe(false);
    });

    it("ValidateLinks failure shows link validation error", () => {
      const error = Deploy.getDeployError("Some random error", "ValidateLinks");
      expect(error.title).toBe("Link validation failed");
      expect(error.needsSupport).toBe(false);
    });

    it("RuntimeValidation failure shows validation error", () => {
      const error = Deploy.getDeployError("Some random error", "RuntimeValidation");
      expect(error.title).toBe("Validation failed");
      expect(error.needsSupport).toBe(false);
    });

    it("FixingBugs failure shows bug fix error", () => {
      const error = Deploy.getDeployError("Some random error", "FixingBugs");
      expect(error.title).toBe("Bug fix failed");
      expect(error.needsSupport).toBe(true);
    });
  });

  describe("the misclassification bug: raw HTML error with 'google' in backtrace", () => {
    const rawHtmlError = `<html><body>ActionController::RoutingError at /deploy...
      google_ads_controller.rb:42 in 'create'
      oauth_callback at middleware/google_oauth.rb:15</body></html>`;

    it("without node: falls through to generic default (not Google)", () => {
      const error = Deploy.getDeployError(rawHtmlError);
      expect(error.title).toBe("Deployment failed");
      expect(error.title).not.toBe("Google connection issue");
    });

    it("with DeployingWebsite node: shows website error (not Google)", () => {
      const error = Deploy.getDeployError(rawHtmlError, "DeployingWebsite");
      expect(error.title).toBe("Website deployment failed");
      expect(error.title).not.toBe("Google connection issue");
    });
  });

  describe("fallback behavior", () => {
    it("returns generic default for undefined input", () => {
      const error = Deploy.getDeployError(undefined);
      expect(error.title).toBe("Deployment failed");
      expect(error.message).toContain("unexpected");
      expect(error.canRetry).toBe(true);
    });

    it("returns generic default for null input", () => {
      const error = Deploy.getDeployError(null);
      expect(error.title).toBe("Deployment failed");
    });

    it("returns generic default for unknown error without node", () => {
      const error = Deploy.getDeployError("some totally unknown error xyz");
      expect(error.title).toBe("Deployment failed");
      expect(error.needsSupport).toBe(true);
    });

    it("returns generic default for unknown node", () => {
      const error = Deploy.getDeployError("some error", "SomeUnknownNode");
      expect(error.title).toBe("Deployment failed");
    });

    it("node alone (no rawError) uses node default", () => {
      const error = Deploy.getDeployError(undefined, "DeployingWebsite");
      expect(error.title).toBe("Website deployment failed");
    });
  });

  describe("needsSupport classification", () => {
    it("website deploy → needsSupport: true", () => {
      expect(Deploy.getDeployError("any error", "DeployingWebsite").needsSupport).toBe(true);
    });

    it("campaign deploy → needsSupport: true", () => {
      expect(Deploy.getDeployError("any error", "DeployingCampaign").needsSupport).toBe(true);
    });

    it("enabling campaign → needsSupport: true", () => {
      expect(Deploy.getDeployError("any error", "EnablingCampaign").needsSupport).toBe(true);
    });

    it("fixing bugs → needsSupport: true", () => {
      expect(Deploy.getDeployError("any error", "FixingBugs").needsSupport).toBe(true);
    });

    it("unknown error → needsSupport: true", () => {
      expect(Deploy.getDeployError("some unknown error").needsSupport).toBe(true);
    });

    it("timed out → needsSupport: false", () => {
      expect(Deploy.getDeployError("timed out", "DeployingWebsite").needsSupport).toBe(false);
    });

    it("network error → needsSupport: false", () => {
      expect(Deploy.getDeployError("ECONNREFUSED", "DeployingWebsite").needsSupport).toBe(false);
    });

    it("rate limit → needsSupport: false", () => {
      expect(Deploy.getDeployError("429 rate limit", "DeployingCampaign").needsSupport).toBe(false);
    });

    it("Google connect → needsSupport: false", () => {
      expect(Deploy.getDeployError("any error", "ConnectingGoogle").needsSupport).toBe(false);
    });

    it("payment → needsSupport: false", () => {
      expect(Deploy.getDeployError("any error", "CheckingBilling").needsSupport).toBe(false);
    });
  });

  describe("needsSupportTicket helper", () => {
    it("returns true for errors needing support", () => {
      expect(Deploy.needsSupportTicket("any error", "DeployingWebsite")).toBe(true);
    });

    it("returns false for transient errors", () => {
      expect(Deploy.needsSupportTicket("ECONNREFUSED", "DeployingWebsite")).toBe(false);
    });

    it("returns true for unknown errors (default)", () => {
      expect(Deploy.needsSupportTicket("some unknown error")).toBe(true);
    });

    it("returns true for undefined/null input (default)", () => {
      expect(Deploy.needsSupportTicket(undefined)).toBe(true);
      expect(Deploy.needsSupportTicket(null)).toBe(true);
    });

    it("accepts node parameter", () => {
      expect(Deploy.needsSupportTicket("any error", "ConnectingGoogle")).toBe(false);
      expect(Deploy.needsSupportTicket("any error", "DeployingCampaign")).toBe(true);
    });
  });
});
