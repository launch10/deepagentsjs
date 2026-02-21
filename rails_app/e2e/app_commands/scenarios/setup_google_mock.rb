# Sets up E2eGoogleAdsClient with desired state for E2E testing.
#
# This replaces the need for test controller endpoints — all state
# manipulation happens in-process via the cypress-on-rails middleware.
#
# Usage:
#   await appScenario('setup_google_mock', { billing: "approved", invite: "accepted" })
#   await appScenario('setup_google_mock', { billing: "none" })
#   await appScenario('setup_google_mock', { error_at: "create_campaign" })
#
# Options:
#   billing:  string - "approved", "pending", "none" (default: "approved")
#   invite:   string - "pending", "accepted", "declined", "expired" (default: "accepted")
#   error_at: string - step name to inject error at, or nil (default: nil)

require_relative "../../../lib/testing/e2e_google_ads_client"

billing = command_options["billing"] || command_options[:billing] || "approved"
invite = command_options["invite"] || command_options[:invite] || "accepted"
error_at = command_options["error_at"] || command_options[:error_at]

GoogleAds.e2e_mock_client = Testing::E2eGoogleAdsClient.new
GoogleAds.e2e_mock_client.billing_status = billing
GoogleAds.e2e_mock_client.invite_status = invite
GoogleAds.e2e_mock_client.should_error_at = error_at

logger.info "[setup_google_mock] billing=#{billing} invite=#{invite} error_at=#{error_at}"

{ status: "ok", billing: billing, invite: invite, error_at: error_at }
