require 'rails_helper'
RSpec.describe GoogleAds::Sync::FieldComparison do
  describe '#values_match?' do
    it 'returns true when transformed value matches their value' do
      comparison = described_class.new(
        field: :amount_cents,
        our_field: :amount_cents,
        our_value: 500,
        their_field: :amount_micros,
        their_value: 5_000_000,
        transform: ->(v) { v * 10_000 }
      )

      expect(comparison.values_match?).to be true
    end

    it 'returns false when transformed value does not match' do
      comparison = described_class.new(
        field: :amount_cents,
        our_field: :amount_cents,
        our_value: 1000,
        their_field: :amount_micros,
        their_value: 5_000_000,
        transform: ->(v) { v * 10_000 }
      )

      expect(comparison.values_match?).to be false
    end

    it 'compares directly when no transform provided' do
      comparison = described_class.new(
        field: :status,
        our_field: :status,
        our_value: :PAUSED,
        their_field: :status,
        their_value: :PAUSED,
        transform: nil
      )

      expect(comparison.values_match?).to be true
    end
  end

  describe '#transformed_our_value' do
    it 'applies transform when provided' do
      comparison = described_class.new(
        field: :cpc_bid_cents,
        our_field: :cpc_bid_cents,
        our_value: 100,
        their_field: :cpc_bid_micros,
        their_value: 1_000_000,
        transform: ->(v) { v * 10_000 }
      )

      expect(comparison.transformed_our_value).to eq(1_000_000)
    end

    it 'returns raw value when no transform' do
      comparison = described_class.new(
        field: :name,
        our_field: :name,
        our_value: "Test",
        their_field: :name,
        their_value: "Test",
        transform: nil
      )

      expect(comparison.transformed_our_value).to eq("Test")
    end
  end

  describe '#to_h' do
    it 'returns a hash with all comparison details' do
      comparison = described_class.new(
        field: :amount_cents,
        our_field: :amount_cents,
        our_value: 500,
        their_field: :amount_micros,
        their_value: 5_000_000,
        transform: ->(v) { v * 10_000 }
      )

      hash = comparison.to_h

      expect(hash[:field]).to eq(:amount_cents)
      expect(hash[:our_field]).to eq(:amount_cents)
      expect(hash[:our_value]).to eq(500)
      expect(hash[:their_field]).to eq(:amount_micros)
      expect(hash[:their_value]).to eq(5_000_000)
      expect(hash[:transformed_our_value]).to eq(5_000_000)
      expect(hash[:values_match]).to be true
    end
  end
end
