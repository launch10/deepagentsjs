require 'rails_helper'

RSpec.describe GoogleAds::SyncResult do
  describe 'action predicates' do
    it '#created? returns true for created action' do
      result = described_class.new(resource_type: :campaign, action: :created)
      expect(result.created?).to be true
      expect(result.updated?).to be false
    end

    it '#updated? returns true for updated action' do
      result = described_class.new(resource_type: :campaign, action: :updated)
      expect(result.updated?).to be true
      expect(result.created?).to be false
    end

    it '#unchanged? returns true for unchanged action' do
      result = described_class.new(resource_type: :campaign, action: :unchanged)
      expect(result.unchanged?).to be true
    end

    it '#not_found? returns true for not_found action' do
      result = described_class.new(resource_type: :campaign, action: :not_found)
      expect(result.not_found?).to be true
    end

    it '#deleted? returns true for deleted action' do
      result = described_class.new(resource_type: :campaign, action: :deleted)
      expect(result.deleted?).to be true
    end

    it '#error? returns true for error action' do
      result = described_class.new(resource_type: :campaign, action: :error, error: StandardError.new("Test"))
      expect(result.error?).to be true
    end
  end

  describe '#success?' do
    it 'returns true for created action' do
      result = described_class.new(resource_type: :campaign, action: :created)
      expect(result.success?).to be true
    end

    it 'returns true for updated action' do
      result = described_class.new(resource_type: :campaign, action: :updated)
      expect(result.success?).to be true
    end

    it 'returns true for unchanged action' do
      result = described_class.new(resource_type: :campaign, action: :unchanged)
      expect(result.success?).to be true
    end

    it 'returns true for deleted action' do
      result = described_class.new(resource_type: :campaign, action: :deleted)
      expect(result.success?).to be true
    end

    it 'returns false for not_found action' do
      result = described_class.new(resource_type: :campaign, action: :not_found)
      expect(result.success?).to be false
    end

    it 'returns false for error action' do
      result = described_class.new(resource_type: :campaign, action: :error, error: StandardError.new("Test"))
      expect(result.success?).to be false
    end
  end

  describe '#synced?' do
    it 'is aliased to success?' do
      results = [
        described_class.new(resource_type: :campaign, action: :created),
        described_class.new(resource_type: :campaign, action: :updated),
        described_class.new(resource_type: :campaign, action: :unchanged),
        described_class.new(resource_type: :campaign, action: :deleted),
        described_class.new(resource_type: :campaign, action: :not_found),
        described_class.new(resource_type: :campaign, action: :error)
      ]

      results.each do |result|
        expect(result.success?).to eq(result.synced?), "Expected success? to equal synced? for action: #{result.action}"
      end
    end
  end

  describe 'factory methods' do
    it '.created returns a created result' do
      result = described_class.created(:campaign, 123)
      expect(result.created?).to be true
      expect(result.resource_type).to eq(:campaign)
      expect(result.resource_name).to eq(123)
    end

    it '.updated returns an updated result' do
      result = described_class.updated(:campaign, 123)
      expect(result.updated?).to be true
      expect(result.resource_type).to eq(:campaign)
      expect(result.resource_name).to eq(123)
    end

    it '.unchanged returns an unchanged result' do
      result = described_class.unchanged(:campaign, 123)
      expect(result.unchanged?).to be true
      expect(result.resource_type).to eq(:campaign)
      expect(result.resource_name).to eq(123)
    end

    it '.deleted returns a deleted result' do
      result = described_class.deleted(:campaign)
      expect(result.deleted?).to be true
      expect(result.resource_type).to eq(:campaign)
    end

    it '.not_found returns a not_found result' do
      result = described_class.not_found(:campaign)
      expect(result.not_found?).to be true
      expect(result.resource_type).to eq(:campaign)
    end

    it '.error returns an error result' do
      error = StandardError.new("Something went wrong")
      result = described_class.error(:campaign, error)
      expect(result.error?).to be true
      expect(result.resource_type).to eq(:campaign)
      expect(result.error).to eq(error)
    end
  end

  describe '#to_h' do
    it 'returns a hash representation' do
      result = described_class.new(
        resource_type: :campaign,
        resource_name: 123,
        action: :updated
      )

      hash = result.to_h

      expect(hash[:resource_type]).to eq(:campaign)
      expect(hash[:resource_name]).to eq(123)
      expect(hash[:action]).to eq(:updated)
      expect(hash[:success]).to be true
      expect(hash[:synced]).to be true
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
      expect(hash[:success]).to be false
    end
  end
end
