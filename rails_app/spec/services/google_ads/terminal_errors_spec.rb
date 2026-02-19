require 'rails_helper'

RSpec.describe GoogleAds::TerminalErrors do
  include GoogleAdsMocks

  before { mock_google_ads_client }

  describe '.terminal?' do
    it 'returns true for DUPLICATE_CAMPAIGN_NAME' do
      error = mock_google_ads_error(
        message: "A campaign with this name already exists",
        error_type: :campaign_error,
        error_value: :DUPLICATE_CAMPAIGN_NAME
      )
      expect(described_class.terminal?(error)).to be true
    end

    it 'returns true for USER_PERMISSION_DENIED' do
      error = mock_permission_denied_error
      expect(described_class.terminal?(error)).to be true
    end

    it 'returns true for CUSTOMER_NOT_FOUND' do
      error = mock_customer_not_found_error
      expect(described_class.terminal?(error)).to be true
    end

    it 'returns true for CUSTOMER_NOT_ENABLED' do
      error = mock_customer_not_enabled_error
      expect(described_class.terminal?(error)).to be true
    end

    it 'returns true for POLICY_FINDING' do
      error = mock_google_ads_error(
        message: "A policy was violated",
        error_type: :policy_finding_error,
        error_value: :POLICY_FINDING
      )
      expect(described_class.terminal?(error)).to be true
    end

    it 'returns true for INVALID_KEYWORD_TEXT' do
      error = mock_google_ads_error(
        message: "The keyword text is invalid",
        error_type: :criterion_error,
        error_value: :INVALID_KEYWORD_TEXT
      )
      expect(described_class.terminal?(error)).to be true
    end

    it 'returns false for non-terminal error codes' do
      error = mock_google_ads_error(
        message: "Internal error",
        error_type: :internal_error,
        error_value: :INTERNAL_ERROR
      )
      expect(described_class.terminal?(error)).to be false
    end

    it 'returns false for INVALID_INPUT (transient request error)' do
      error = mock_invalid_argument_error
      expect(described_class.terminal?(error)).to be false
    end

    it 'returns false for non-GoogleAdsError objects' do
      error = StandardError.new("Something went wrong")
      expect(described_class.terminal?(error)).to be false
    end

    it 'returns false for SyncVerificationError' do
      error = GoogleAds::SyncVerificationError.new("Mismatched fields: status")
      expect(described_class.terminal?(error)).to be false
    end

    it 'returns false for nil' do
      expect(described_class.terminal?(nil)).to be false
    end
  end
end
