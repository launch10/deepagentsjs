require 'rails_helper'

RSpec.describe GoogleAds::Sync::SyncResult do
  describe 'action predicates' do
    it '#created? returns true for created action' do
      result = described_class.new(resource_type: :campaign_budget, action: :created)
      expect(result.created?).to be true
      expect(result.updated?).to be false
    end

    it '#updated? returns true for updated action' do
      result = described_class.new(resource_type: :campaign_budget, action: :updated)
      expect(result.updated?).to be true
      expect(result.created?).to be false
    end

    it '#unchanged? returns true for unchanged action' do
      result = described_class.new(resource_type: :campaign_budget, action: :unchanged)
      expect(result.unchanged?).to be true
    end

    it '#not_found? returns true for not_found action' do
      result = described_class.new(resource_type: :campaign_budget, action: :not_found)
      expect(result.not_found?).to be true
    end

    it '#deleted? returns true for deleted action' do
      result = described_class.new(resource_type: :campaign_budget, action: :deleted)
      expect(result.deleted?).to be true
    end

    it '#error? returns true for error action' do
      result = described_class.new(resource_type: :campaign_budget, action: :error, error: StandardError.new("Test"))
      expect(result.error?).to be true
    end
  end

  describe '#success? and #synced?' do
    it 'returns true for created action' do
      result = described_class.new(resource_type: :campaign_budget, action: :created)
      expect(result.success?).to be true
      expect(result.synced?).to be true
    end

    it 'returns true for updated action' do
      result = described_class.new(resource_type: :campaign_budget, action: :updated)
      expect(result.success?).to be true
      expect(result.synced?).to be true
    end

    it 'returns true for unchanged action' do
      result = described_class.new(resource_type: :campaign_budget, action: :unchanged)
      expect(result.success?).to be true
      expect(result.synced?).to be true
    end

    it 'returns true for deleted action' do
      result = described_class.new(resource_type: :campaign_budget, action: :deleted)
      expect(result.success?).to be true
      expect(result.synced?).to be true
    end

    it 'returns false for not_found action' do
      result = described_class.new(resource_type: :campaign_budget, action: :not_found)
      expect(result.success?).to be false
      expect(result.synced?).to be false
    end

    it 'returns false for error action' do
      result = described_class.new(
        resource_type: :campaign_budget,
        action: :error,
        error: StandardError.new("Test")
      )
      expect(result.success?).to be false
      expect(result.synced?).to be false
    end

    it 'success? is always equivalent to synced?' do
      results = [
        described_class.new(resource_type: :campaign_budget, action: :created),
        described_class.new(resource_type: :campaign_budget, action: :updated),
        described_class.new(resource_type: :campaign_budget, action: :unchanged),
        described_class.new(resource_type: :campaign_budget, action: :deleted),
        described_class.new(resource_type: :campaign_budget, action: :not_found),
        described_class.new(resource_type: :campaign_budget, action: :error)
      ]

      results.each do |result|
        expect(result.success?).to eq(result.synced?), "Expected success? to equal synced? for action: #{result.action}"
      end
    end
  end

  describe '#to_h' do
    it 'returns a hash representation for debugging' do
      result = described_class.new(
        resource_type: :campaign_budget,
        resource_name: "customers/123/campaignBudgets/456",
        action: :updated
      )

      hash = result.to_h

      expect(hash[:resource_type]).to eq(:campaign_budget)
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
