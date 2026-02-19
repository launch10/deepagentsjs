require 'rails_helper'

RSpec.describe GoogleAds::Sync::SyncResult do
  describe 'action predicates' do
    it '#created? returns true for created action' do
      result = described_class.new(resource_type: :budget, action: :created)
      expect(result.created?).to be true
      expect(result.updated?).to be false
    end

    it '#updated? returns true for updated action' do
      result = described_class.new(resource_type: :budget, action: :updated)
      expect(result.updated?).to be true
      expect(result.created?).to be false
    end

    it '#unchanged? returns true for unchanged action' do
      result = described_class.new(resource_type: :budget, action: :unchanged)
      expect(result.unchanged?).to be true
    end

    it '#not_found? returns true for not_found action' do
      result = described_class.new(resource_type: :budget, action: :not_found)
      expect(result.not_found?).to be true
    end

    it '#deleted? returns true for deleted action' do
      result = described_class.new(resource_type: :budget, action: :deleted)
      expect(result.deleted?).to be true
    end

    it '#error? returns true for error action' do
      result = described_class.new(resource_type: :budget, action: :error, error: StandardError.new("Test"))
      expect(result.error?).to be true
    end
  end

  describe '#success? and #synced?' do
    it 'returns true for created action' do
      result = described_class.new(resource_type: :budget, action: :created)
      expect(result.success?).to be true
      expect(result.synced?).to be true
    end

    it 'returns true for updated action' do
      result = described_class.new(resource_type: :budget, action: :updated)
      expect(result.success?).to be true
      expect(result.synced?).to be true
    end

    it 'returns true for unchanged action' do
      result = described_class.new(resource_type: :budget, action: :unchanged)
      expect(result.success?).to be true
      expect(result.synced?).to be true
    end

    it 'returns true for deleted action' do
      result = described_class.new(resource_type: :budget, action: :deleted)
      expect(result.success?).to be true
      expect(result.synced?).to be true
    end

    it 'returns false for not_found action' do
      result = described_class.new(resource_type: :budget, action: :not_found)
      expect(result.success?).to be false
      expect(result.synced?).to be false
    end

    it 'returns false for error action' do
      result = described_class.new(
        resource_type: :budget,
        action: :error,
        error: StandardError.new("Test")
      )
      expect(result.success?).to be false
      expect(result.synced?).to be false
    end

    it 'success? is always equivalent to synced?' do
      results = [
        described_class.new(resource_type: :budget, action: :created),
        described_class.new(resource_type: :budget, action: :updated),
        described_class.new(resource_type: :budget, action: :unchanged),
        described_class.new(resource_type: :budget, action: :deleted),
        described_class.new(resource_type: :budget, action: :not_found),
        described_class.new(resource_type: :budget, action: :error)
      ]

      results.each do |result|
        expect(result.success?).to eq(result.synced?), "Expected success? to equal synced? for action: #{result.action}"
      end
    end
  end

  describe '#to_h' do
    it 'returns a hash representation for debugging' do
      result = described_class.new(
        resource_type: :budget,
        resource_name: "customers/123/campaignBudgets/456",
        action: :updated
      )

      hash = result.to_h

      expect(hash[:resource_type]).to eq(:budget)
      expect(hash[:resource_name]).to eq("customers/123/campaignBudgets/456")
      expect(hash[:action]).to eq(:updated)
      expect(hash[:success]).to be true
    end

    it 'includes error message when present' do
      error = StandardError.new("Something went wrong")
      result = described_class.new(
        resource_type: :campaign,
        action: :error,
        error: error
      )

      hash = result.to_h
      expect(hash[:error]).to eq("Something went wrong")
    end
  end
end

RSpec.describe GoogleAds::SyncResult, type: :model do
  include GoogleAdsMocks

  before { mock_google_ads_client }

  describe '#terminal?' do
    it 'returns true for terminal GoogleAdsError' do
      error = mock_google_ads_error(
        message: "Duplicate campaign name",
        error_type: :campaign_error,
        error_value: :DUPLICATE_CAMPAIGN_NAME
      )
      result = described_class.error(:campaign, error)
      expect(result.terminal?).to be true
    end

    it 'returns false for non-terminal GoogleAdsError' do
      error = mock_google_ads_error(
        message: "Internal error",
        error_type: :internal_error,
        error_value: :INTERNAL_ERROR
      )
      result = described_class.error(:campaign, error)
      expect(result.terminal?).to be false
    end

    it 'returns false for non-error results' do
      result = described_class.created(:campaign, "123")
      expect(result.terminal?).to be false
    end

    it 'returns false for StandardError' do
      result = described_class.error(:campaign, StandardError.new("oops"))
      expect(result.terminal?).to be false
    end

    it 'returns false for SyncVerificationError' do
      error = GoogleAds::SyncVerificationError.new("Mismatched fields")
      result = described_class.error(:campaign, error)
      expect(result.terminal?).to be false
    end
  end

  describe '#to_h error formatting' do
    it 'returns nil error when no error present' do
      result = described_class.created(:budget, "123")
      expect(result.to_h[:error]).to be_nil
    end

    it 'returns standard error message for non-GoogleAdsError' do
      error = StandardError.new("Something went wrong")
      result = described_class.error(:budget, error)
      expect(result.to_h[:error]).to eq("Something went wrong")
    end

    it 'extracts failure details from GoogleAdsError' do
      google_error = mock_google_ads_error(
        message: "User doesn't have permission to access customer",
        error_type: :authorization_error,
        error_value: :USER_PERMISSION_DENIED
      )
      result = described_class.error(:campaign, google_error)

      error_text = result.to_h[:error]
      expect(error_text).to include("User doesn't have permission to access customer")
    end

    it 'includes human-readable message from GoogleAdsError failure' do
      google_error = mock_google_ads_error(
        message: "A policy was violated",
        error_type: :policy_finding_error,
        error_value: :POLICY_FINDING
      )
      result = described_class.error(:ad_group_ad, google_error)

      error_text = result.to_h[:error]
      # The human-readable message from failure.errors[].message is extracted
      expect(error_text).to include("A policy was violated")
      # Note: error_code details require real protobuf objects (not test doubles),
      # so they won't appear in mocked tests but will in production
    end

    it 'handles SyncVerificationError' do
      error = GoogleAds::SyncVerificationError.new("Ad sync verification failed. Mismatched fields: status")
      result = described_class.error(:ad_group_ad, error)
      expect(result.to_h[:error]).to eq("Ad sync verification failed. Mismatched fields: status")
    end
  end
end
