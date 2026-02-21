import { appScenario, appEval } from "../support/on-rails";

/**
 * E2E mock helpers for controlling Google Ads and Cloudflare mock state.
 *
 * All state manipulation uses cypress-on-rails infrastructure (appScenario/appEval).
 * No test controller endpoints needed.
 */
export const E2EMocks = {
  /**
   * Set up the Google Ads mock client with desired state.
   * Creates a fresh E2eGoogleAdsClient and configures it.
   */
  async setupGoogleMock(
    opts: {
      billing?: "approved" | "pending" | "none";
      invite?: "pending" | "accepted" | "declined" | "expired";
      error_at?: string | null;
    } = {}
  ) {
    return appScenario("setup_google_mock", {
      billing: opts.billing ?? "approved",
      invite: opts.invite ?? "accepted",
      error_at: opts.error_at ?? null,
    });
  },

  /**
   * Set up deploy mocks so website/campaign deploys don't hit Cloudflare R2.
   * Installs an in-memory S3 client via Cloudflare.e2e_mock_s3_client.
   */
  async setupDeployMocks() {
    return appScenario("setup_deploy_mocks");
  },

  /**
   * Simulate OAuth completion (the ONE flow that's a browser redirect).
   * Creates ConnectedAccount and completes the pending GoogleOAuthConnect job_run.
   */
  async completeOAuth(email: string, googleEmail?: string) {
    return appScenario<{
      status: string;
      email: string;
      connected_account_id: number;
      job_run_id: number | null;
    }>("complete_oauth", {
      email,
      google_email: googleEmail ?? "test@launch10.ai",
    });
  },

  /**
   * Set the invite status on the mock client.
   * Convenience wrapper — creates client if not present.
   */
  async setInviteStatus(status: "pending" | "accepted" | "declined" | "expired") {
    return appEval(`
      require_relative "#{Rails.root}/lib/testing/e2e_google_ads_client"
      GoogleAds.e2e_mock_client ||= Testing::E2eGoogleAdsClient.new
      GoogleAds.e2e_mock_client.invite_status = "${status}"
      { status: "ok" }
    `);
  },

  /**
   * Set the billing status on the mock client.
   * Convenience wrapper — creates client if not present.
   */
  async setBillingStatus(status: "approved" | "pending" | "none") {
    return appEval(`
      require_relative "#{Rails.root}/lib/testing/e2e_google_ads_client"
      GoogleAds.e2e_mock_client ||= Testing::E2eGoogleAdsClient.new
      GoogleAds.e2e_mock_client.billing_status = "${status}"
      { status: "ok" }
    `);
  },

  /**
   * Inject an error at a specific deploy step.
   * Pass null to clear the error.
   */
  async setErrorAt(step: string | null) {
    const value = step ? `"${step}"` : "nil";
    return appEval(`
      require_relative "#{Rails.root}/lib/testing/e2e_google_ads_client"
      GoogleAds.e2e_mock_client ||= Testing::E2eGoogleAdsClient.new
      GoogleAds.e2e_mock_client.should_error_at = ${value}
      { status: "ok" }
    `);
  },

  /**
   * Create a Google OAuth ConnectedAccount so the OAuth step is skipped during deploy.
   */
  async createGoogleAccount(email: string, googleEmail?: string) {
    return appScenario("create_google_connected_account", {
      email,
      google_email: googleEmail ?? "test@launch10.ai",
    });
  },

  /**
   * Reset all mocks — clears Google Ads mock client and Cloudflare R2 mock.
   */
  async reset() {
    return appEval(
      'GoogleAds.e2e_mock_client = nil; Cloudflare.e2e_mock_s3_client = nil; { status: "ok" }'
    );
  },
};
