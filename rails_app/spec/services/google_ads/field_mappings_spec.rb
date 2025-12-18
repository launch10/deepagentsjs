require 'rails_helper'

RSpec.describe GoogleAds::Sync::FieldMappings do
  describe '.for' do
    it 'returns BUDGET_FIELDS for AdBudget' do
      expect(described_class.for(AdBudget)).to eq(described_class::BUDGET_FIELDS)
    end

    it 'returns CAMPAIGN_FIELDS for Campaign' do
      expect(described_class.for(Campaign)).to eq(described_class::CAMPAIGN_FIELDS)
    end

    it 'returns AD_GROUP_FIELDS for AdGroup' do
      expect(described_class.for(AdGroup)).to eq(described_class::AD_GROUP_FIELDS)
    end

    it 'returns ADS_ACCOUNT_FIELDS for AdsAccount' do
      expect(described_class.for(AdsAccount)).to eq(described_class::ADS_ACCOUNT_FIELDS)
    end

    it 'raises ArgumentError for unknown resource type' do
      expect { described_class.for(String) }.to raise_error(ArgumentError, /Unknown resource type/)
    end
  end

  describe 'ADS_ACCOUNT_FIELDS' do
    let(:fields) { described_class::ADS_ACCOUNT_FIELDS }

    it 'defines descriptive_name mapping' do
      mapping = fields[:descriptive_name]
      expect(mapping[:our_field]).to eq(:google_descriptive_name)
      expect(mapping[:their_field]).to eq(:descriptive_name)
      expect(mapping[:transform].call("Test")).to eq("Test")
    end

    it 'defines currency_code mapping' do
      mapping = fields[:currency_code]
      expect(mapping[:our_field]).to eq(:google_currency_code)
      expect(mapping[:their_field]).to eq(:currency_code)
      expect(mapping[:transform].call("USD")).to eq("USD")
    end

    it 'defines time_zone mapping' do
      mapping = fields[:time_zone]
      expect(mapping[:our_field]).to eq(:google_time_zone)
      expect(mapping[:their_field]).to eq(:time_zone)
      expect(mapping[:transform].call("America/New_York")).to eq("America/New_York")
    end

    it 'defines status mapping' do
      mapping = fields[:status]
      expect(mapping[:our_field]).to eq(:google_status)
      expect(mapping[:their_field]).to eq(:status)
      expect(mapping[:transform].call("ENABLED")).to eq("ENABLED")
    end

    it 'defines auto_tagging_enabled mapping' do
      mapping = fields[:auto_tagging_enabled]
      expect(mapping[:our_field]).to eq(:google_auto_tagging_enabled)
      expect(mapping[:their_field]).to eq(:auto_tagging_enabled)
      expect(mapping[:transform].call(true)).to eq(true)
    end
  end

  describe '.to_google' do
    let(:account) { create(:account, name: "Test Account") }
    let(:ads_account) { account.ads_accounts.create!(platform: "google") }

    before do
      ads_account.google_descriptive_name = "My Campaign Account"
      ads_account.google_currency_code = "EUR"
      ads_account.google_time_zone = "Europe/London"
      ads_account.google_status = "ENABLED"
      ads_account.google_auto_tagging_enabled = true
      ads_account.save!
    end

    it 'converts AdsAccount to Google format' do
      result = described_class.to_google(ads_account)

      expect(result[:descriptive_name]).to eq("My Campaign Account")
      expect(result[:currency_code]).to eq("EUR")
      expect(result[:time_zone]).to eq("Europe/London")
      expect(result[:status]).to eq("ENABLED")
      expect(result[:auto_tagging_enabled]).to eq(true)
    end

    it 'skips nil values' do
      resource = double("Resource", google_descriptive_name: "Test", google_currency_code: nil)
      allow(resource).to receive(:class).and_return(AdsAccount)
      allow(resource).to receive(:respond_to?).and_return(true)
      allow(resource).to receive(:google_time_zone).and_return(nil)
      allow(resource).to receive(:google_status).and_return(nil)
      allow(resource).to receive(:google_auto_tagging_enabled).and_return(nil)

      result = described_class.to_google(resource)

      expect(result[:descriptive_name]).to eq("Test")
      expect(result).not_to have_key(:currency_code)
      expect(result).not_to have_key(:time_zone)
      expect(result).not_to have_key(:status)
      expect(result).not_to have_key(:auto_tagging_enabled)
    end
  end

  describe '.from_google' do
    let(:google_resource) do
      {
        descriptive_name: "Google Account Name",
        currency_code: "GBP",
        time_zone: "Europe/Paris",
        status: :ENABLED,
        auto_tagging_enabled: false
      }
    end

    it 'converts Google format to our format' do
      result = described_class.from_google(google_resource, AdsAccount)

      expect(result[:google_descriptive_name]).to eq("Google Account Name")
      expect(result[:google_currency_code]).to eq("GBP")
      expect(result[:google_time_zone]).to eq("Europe/Paris")
      expect(result[:google_status]).to eq(:ENABLED)
    end

    it 'handles boolean false values' do
      resource_with_false = {
        descriptive_name: "Test",
        auto_tagging_enabled: false
      }

      result = described_class.from_google(resource_with_false, AdsAccount)

      expect(result[:google_auto_tagging_enabled]).to eq(false)
    end

    it 'works with string keys' do
      string_resource = {
        "descriptive_name" => "String Key Account",
        "currency_code" => "CAD"
      }

      result = described_class.from_google(string_resource, AdsAccount)

      expect(result[:google_descriptive_name]).to eq("String Key Account")
      expect(result[:google_currency_code]).to eq("CAD")
    end

    it 'works with object-style resources' do
      object_resource = double(
        "GoogleCustomer",
        descriptive_name: "Object Account",
        currency_code: "JPY",
        time_zone: "Asia/Tokyo",
        status: :ENABLED,
        auto_tagging_enabled: true
      )

      result = described_class.from_google(object_resource, AdsAccount)

      expect(result[:google_descriptive_name]).to eq("Object Account")
      expect(result[:google_currency_code]).to eq("JPY")
      expect(result[:google_time_zone]).to eq("Asia/Tokyo")
    end
  end

  describe 'transforms' do
    describe 'CENTS_TO_MICROS' do
      it 'converts cents to micros' do
        expect(described_class::CENTS_TO_MICROS.call(500)).to eq(5_000_000)
      end
    end

    describe 'MICROS_TO_CENTS' do
      it 'converts micros to cents' do
        expect(described_class::MICROS_TO_CENTS.call(5_000_000)).to eq(500)
      end
    end

    describe 'DOLLARS_TO_MICROS' do
      it 'converts dollars to micros' do
        expect(described_class::DOLLARS_TO_MICROS.call(50)).to eq(50_000_000)
      end
    end

    describe 'MICROS_TO_DOLLARS' do
      it 'converts micros to dollars' do
        expect(described_class::MICROS_TO_DOLLARS.call(50_000_000)).to eq(50.0)
      end
    end

    describe 'ITSELF' do
      it 'returns the value unchanged' do
        expect(described_class::ITSELF.call("test")).to eq("test")
        expect(described_class::ITSELF.call(123)).to eq(123)
        expect(described_class::ITSELF.call(true)).to eq(true)
      end
    end
  end
end
