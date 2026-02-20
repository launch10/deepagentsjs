require "rails_helper"

RSpec.describe JobErrorConfig do
  describe ".recoverable?" do
    # All error types are non-recoverable (fail fast philosophy)
    it "returns false for api_outage" do
      expect(JobErrorConfig.recoverable?("WebsiteDeploy", "api_outage")).to be false
    end

    it "returns false for rate_limit" do
      expect(JobErrorConfig.recoverable?("CampaignDeploy", "rate_limit")).to be false
    end

    it "returns false for timeout" do
      expect(JobErrorConfig.recoverable?("CampaignEnable", "timeout")).to be false
    end

    it "returns false for internal errors" do
      expect(JobErrorConfig.recoverable?("WebsiteDeploy", "internal")).to be false
    end

    it "returns false for auth_failure" do
      expect(JobErrorConfig.recoverable?("CampaignDeploy", "auth_failure")).to be false
    end

    it "returns false for invalid_data" do
      expect(JobErrorConfig.recoverable?("WebsiteDeploy", "invalid_data")).to be false
    end

    it "returns false for policy_violation" do
      expect(JobErrorConfig.recoverable?("CampaignEnable", "policy_violation")).to be false
    end

    it "returns false for not_found" do
      expect(JobErrorConfig.recoverable?("GoogleAdsInvite", "not_found")).to be false
    end

    # Unknown error types default to non-recoverable (fail fast)
    it "returns false for unknown error types" do
      expect(JobErrorConfig.recoverable?("WebsiteDeploy", "something_new")).to be false
    end

    # All job names work
    it "returns false for all registered job names (fail fast)" do
      %w[WebsiteDeploy CampaignDeploy CampaignEnable GoogleOAuthConnect GoogleAdsInvite GoogleAdsPaymentCheck].each do |job|
        expect(JobErrorConfig.recoverable?(job, "api_outage")).to be false
      end
    end
  end

  describe ".error_types" do
    it "returns all known error types" do
      expect(JobErrorConfig.error_types).to include(
        "api_outage", "rate_limit", "auth_failure", "invalid_data",
        "policy_violation", "timeout", "not_found", "internal"
      )
    end
  end

  describe "config loading" do
    before do
      # Reset memoized config between tests
      JobErrorConfig.instance_variable_set(:@config, nil)
    end

    after do
      # Restore for other tests
      JobErrorConfig.instance_variable_set(:@config, nil)
    end

    it "raises with helpful message when file is missing" do
      stub_const("JobErrorConfig::CONFIG_PATH", Rails.root.join("nonexistent/jobErrors.json"))

      expect { JobErrorConfig.error_types }.to raise_error(RuntimeError, /jobErrors\.json not found/)
    end

    it "raises with helpful message when JSON is malformed" do
      stub_const("JobErrorConfig::CONFIG_PATH", Rails.root.join("nonexistent/jobErrors.json"))
      allow(File).to receive(:exist?).and_call_original
      allow(File).to receive(:exist?).with(JobErrorConfig::CONFIG_PATH).and_return(true)
      allow(File).to receive(:read).and_call_original
      allow(File).to receive(:read).with(JobErrorConfig::CONFIG_PATH).and_return('{"only": "partial"}')

      expect { JobErrorConfig.error_types }.to raise_error(RuntimeError, /malformed.*missing required keys/)
    end
  end
end
