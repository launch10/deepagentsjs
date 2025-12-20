# == Schema Information
#
# Table name: ads_accounts
#
#  id                :bigint           not null, primary key
#  deleted_at        :datetime
#  platform          :string           not null
#  platform_settings :jsonb
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  account_id        :bigint           not null
#
# Indexes
#
#  index_ads_accounts_on_account_id               (account_id)
#  index_ads_accounts_on_account_id_and_platform  (account_id,platform) UNIQUE
#  index_ads_accounts_on_deleted_at               (deleted_at)
#  index_ads_accounts_on_google_id                (((platform_settings ->> 'google'::text)))
#  index_ads_accounts_on_platform                 (platform)
#  index_ads_accounts_on_platform_settings        (platform_settings) USING gin
#
require 'rails_helper'

RSpec.describe AdsAccount, type: :model do
  let(:account) { create(:account, name: "Test Account", time_zone: "America/Los_Angeles") }
  let(:ads_account) { account.ads_accounts.create!(platform: "google") }

  describe 'associations' do
    it { should belong_to(:account) }
  end

  describe 'validations' do
    it { should validate_presence_of(:platform) }
    it { should validate_inclusion_of(:platform).in_array(AdsAccount::PLATFORMS) }
  end

  describe 'platform_settings' do
    describe 'google_customer_id' do
      it 'stores and retrieves customer_id' do
        ads_account.google_customer_id = "123456789"
        ads_account.save!

        expect(ads_account.reload.google_customer_id).to eq("123456789")
      end
    end

    describe 'google_descriptive_name' do
      it 'defaults to account name' do
        expect(ads_account.google_descriptive_name).to eq("Test Account")
      end

      it 'can be overridden' do
        ads_account.google_descriptive_name = "Custom Name"
        ads_account.save!

        expect(ads_account.reload.google_descriptive_name).to eq("Custom Name")
      end
    end

    describe 'google_currency_code' do
      it 'defaults to USD' do
        expect(ads_account.google_currency_code).to eq("USD")
      end

      it 'can be set to a custom value' do
        ads_account.google_currency_code = "EUR"
        ads_account.save!

        expect(ads_account.reload.google_currency_code).to eq("EUR")
      end
    end

    describe 'google_time_zone' do
      it 'uses account time_zone when available' do
        expect(ads_account.google_time_zone).to eq("America/Los_Angeles")
      end

      it 'defaults to America/New_York when account has no time_zone' do
        account.update!(time_zone: nil)
        new_ads_account = account.ads_accounts.create!(platform: "google")

        expect(new_ads_account.google_time_zone).to eq("America/New_York")
      end
    end

    describe 'google_status' do
      it 'defaults to ENABLED' do
        expect(ads_account.google_status).to eq("ENABLED")
      end

      it 'can be set to other values' do
        ads_account.google_status = "CANCELED"
        ads_account.save!

        expect(ads_account.reload.google_status).to eq("CANCELED")
      end
    end

    describe 'google_auto_tagging_enabled' do
      it 'defaults to true' do
        expect(ads_account.google_auto_tagging_enabled).to eq(true)
      end

      it 'can be set to false' do
        ads_account.google_auto_tagging_enabled = false
        ads_account.save!

        expect(ads_account.reload.google_auto_tagging_enabled).to eq(false)
      end
    end
  end

  describe 'GoogleSyncable' do
    it 'includes GoogleSyncable' do
      expect(AdsAccount.ancestors).to include(GoogleSyncable)
    end

    it 'uses GoogleAds::Account syncer' do
      expect(ads_account.google_syncer).to be_a(GoogleAds::Account)
    end

    it 'responds to google_sync' do
      expect(ads_account).to respond_to(:google_sync)
    end

    it 'responds to google_synced?' do
      expect(ads_account).to respond_to(:google_synced?)
    end

    it 'responds to google_sync_result' do
      expect(ads_account).to respond_to(:google_sync_result)
    end

    it 'responds to google_delete' do
      expect(ads_account).to respond_to(:google_delete)
    end
  end

  describe 'GoogleMappable' do
    it 'includes GoogleMappable' do
      expect(AdsAccount.ancestors).to include(GoogleMappable)
    end

    it 'responds to to_google_json' do
      expect(ads_account).to respond_to(:to_google_json)
    end

    it 'responds to from_google_json' do
      expect(AdsAccount).to respond_to(:from_google_json)
    end
  end

  describe '#set_google_customer_id' do
    it 'extracts customer_id from resource_name' do
      result = double("SyncResult", resource_name: "customers/9876543210")

      ads_account.set_google_customer_id(result)

      expect(ads_account.google_customer_id).to eq("9876543210")
    end

    it 'does nothing when resource_name is nil' do
      result = double("SyncResult", resource_name: nil)
      ads_account.google_customer_id = "existing_id"

      ads_account.set_google_customer_id(result)

      expect(ads_account.google_customer_id).to eq("existing_id")
    end

    it 'does nothing when resource_name is blank' do
      result = double("SyncResult", resource_name: "")
      ads_account.google_customer_id = "existing_id"

      ads_account.set_google_customer_id(result)

      expect(ads_account.google_customer_id).to eq("existing_id")
    end
  end

  describe 'to_google_json' do
    before do
      ads_account.google_descriptive_name = "My Account"
      ads_account.google_currency_code = "USD"
      ads_account.google_time_zone = "America/New_York"
      ads_account.google_status = "ENABLED"
      ads_account.google_auto_tagging_enabled = true
      ads_account.save!
    end

    it 'converts to Google API format' do
      json = ads_account.to_google_json

      expect(json[:descriptive_name]).to eq("My Account")
      expect(json[:currency_code]).to eq("USD")
      expect(json[:time_zone]).to eq("America/New_York")
      expect(json[:status]).to eq("ENABLED")
      expect(json[:auto_tagging_enabled]).to eq(true)
    end
  end
end
