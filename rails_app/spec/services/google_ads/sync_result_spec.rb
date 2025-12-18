require 'rails_helper'
RSpec.describe GoogleAds::Sync::SyncResult do
  let(:matching_comparison) do
    GoogleAds::Sync::FieldComparison.new(
      field: :amount_cents,
      our_field: :amount_cents,
      our_value: 500,
      their_field: :amount_micros,
      their_value: 5_000_000,
      transform: ->(v) { v * 10_000 }
    )
  end

  let(:mismatched_comparison) do
    GoogleAds::Sync::FieldComparison.new(
      field: :status,
      our_field: :status,
      our_value: :ENABLED,
      their_field: :status,
      their_value: :PAUSED,
      transform: nil
    )
  end

  describe '#values_match?' do
    it 'returns true when all comparisons match' do
      result = described_class.new(
        resource_type: :campaign_budget,
        resource_name: "customers/123/campaignBudgets/456",
        action: :unchanged,
        comparisons: [matching_comparison]
      )

      expect(result.values_match?).to be true
    end

    it 'returns false when any comparison does not match' do
      result = described_class.new(
        resource_type: :campaign,
        resource_name: "customers/123/campaigns/789",
        action: :unchanged,
        comparisons: [matching_comparison, mismatched_comparison]
      )

      expect(result.values_match?).to be false
    end
  end

  describe '#mismatched_fields' do
    it 'returns only non-matching comparisons' do
      result = described_class.new(
        resource_type: :campaign,
        resource_name: "customers/123/campaigns/789",
        action: :unchanged,
        comparisons: [matching_comparison, mismatched_comparison]
      )

      expect(result.mismatched_fields.length).to eq(1)
      expect(result.mismatched_fields.first.field).to eq(:status)
    end
  end

  describe '#matched_fields' do
    it 'returns only matching comparisons' do
      result = described_class.new(
        resource_type: :campaign,
        resource_name: "customers/123/campaigns/789",
        action: :unchanged,
        comparisons: [matching_comparison, mismatched_comparison]
      )

      expect(result.matched_fields.length).to eq(1)
      expect(result.matched_fields.first.field).to eq(:amount_cents)
    end
  end

  describe '#comparison_for' do
    it 'returns the comparison for a specific field' do
      result = described_class.new(
        resource_type: :campaign,
        resource_name: "customers/123/campaigns/789",
        action: :unchanged,
        comparisons: [matching_comparison, mismatched_comparison]
      )

      comparison = result.comparison_for(:amount_cents)
      expect(comparison.our_value).to eq(500)
      expect(comparison.their_value).to eq(5_000_000)
    end

    it 'returns nil for unknown field' do
      result = described_class.new(
        resource_type: :campaign,
        resource_name: "customers/123/campaigns/789",
        action: :unchanged,
        comparisons: [matching_comparison]
      )

      expect(result.comparison_for(:unknown_field)).to be_nil
    end
  end

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

    it '#error? returns true for error action' do
      result = described_class.new(resource_type: :campaign_budget, action: :error, error: StandardError.new("Test"))
      expect(result.error?).to be true
    end
  end

  describe '#success?' do
    it 'returns true for created, updated, unchanged actions' do
      [:created, :updated, :unchanged].each do |action|
        result = described_class.new(resource_type: :campaign_budget, action: action)
        expect(result.success?).to be true
      end
    end

    it 'returns false for not_found and error actions' do
      [:not_found, :error].each do |action|
        result = described_class.new(resource_type: :campaign_budget, action: action)
        expect(result.success?).to be false
      end
    end
  end

  describe '#to_h' do
    it 'returns a hash representation for debugging' do
      result = described_class.new(
        resource_type: :campaign_budget,
        resource_name: "customers/123/campaignBudgets/456",
        action: :updated,
        comparisons: [matching_comparison, mismatched_comparison]
      )

      hash = result.to_h

      expect(hash[:resource_type]).to eq(:campaign_budget)
      expect(hash[:resource_name]).to eq("customers/123/campaignBudgets/456")
      expect(hash[:action]).to eq(:updated)
      expect(hash[:success]).to be true
      expect(hash[:synced]).to be false
      expect(hash[:mismatched_fields]).to eq([:status])
      expect(hash[:comparisons].length).to eq(2)
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
