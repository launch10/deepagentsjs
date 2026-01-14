# == Schema Information
#
# Table name: campaigns
#
#  id                :bigint           not null, primary key
#  deleted_at        :datetime
#  end_date          :date
#  launched_at       :datetime
#  name              :string
#  platform_settings :jsonb
#  stage             :string           default("content")
#  start_date        :date
#  status            :string           default("draft")
#  time_zone         :string           default("America/New_York")
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  account_id        :bigint
#  ads_account_id    :bigint
#  project_id        :bigint
#  website_id        :bigint
#
# Indexes
#
#  index_campaigns_on_account_id             (account_id)
#  index_campaigns_on_account_id_and_stage   (account_id,stage)
#  index_campaigns_on_account_id_and_status  (account_id,status)
#  index_campaigns_on_ads_account_id         (ads_account_id)
#  index_campaigns_on_created_at             (created_at)
#  index_campaigns_on_deleted_at             (deleted_at)
#  index_campaigns_on_end_date               (end_date)
#  index_campaigns_on_google_id              ((((platform_settings -> 'google'::text) ->> 'campaign_id'::text)))
#  index_campaigns_on_launched_at            (launched_at)
#  index_campaigns_on_platform_settings      (platform_settings) USING gin
#  index_campaigns_on_project_id             (project_id)
#  index_campaigns_on_project_id_and_stage   (project_id,stage)
#  index_campaigns_on_project_id_and_status  (project_id,status)
#  index_campaigns_on_stage                  (stage)
#  index_campaigns_on_start_date             (start_date)
#  index_campaigns_on_status                 (status)
#  index_campaigns_on_website_id             (website_id)
#
require 'rails_helper'

RSpec.describe Campaign, type: :model do
  let(:account) { create(:account) }
  let(:website) { create(:website, account: account) }

  describe "validations" do
    it { should validate_presence_of(:status) }
    it { should validate_inclusion_of(:status).in_array(Campaign::STATUSES) }
    it { should validate_presence_of(:stage) }
    it { should validate_inclusion_of(:stage).in_array(Campaign::STAGES) }

    describe "time_zone" do
      it "allows valid IANA time zone identifiers" do
        campaign = build(:campaign, time_zone: "America/New_York")
        expect(campaign).to be_valid

        campaign.time_zone = "Europe/London"
        expect(campaign).to be_valid

        campaign.time_zone = "Asia/Tokyo"
        expect(campaign).to be_valid
      end

      it "allows nil time_zone" do
        campaign = build(:campaign, time_zone: nil)
        expect(campaign).to be_valid
      end

      it "rejects invalid time zone identifiers" do
        campaign = build(:campaign, time_zone: "Invalid/Timezone")
        expect(campaign).to_not be_valid
        expect(campaign.errors[:time_zone]).to include("is not included in the list")

        campaign.time_zone = "EST"
        expect(campaign).to_not be_valid
        expect(campaign.errors[:time_zone]).to include("is not included in the list")
      end
    end
  end

  describe "nested attributes" do
    it { should accept_nested_attributes_for(:ad_groups).allow_destroy(true) }
    it { should accept_nested_attributes_for(:callouts).allow_destroy(true) }
    it { should accept_nested_attributes_for(:structured_snippet) }
  end

  describe "PlatformSettings" do
    it "initializes platform_settings as empty hash" do
      campaign = build(:campaign)
      expect(campaign.platform_settings).to eq({ "google" => {}, "meta" => {} })
    end

    describe "google settings" do
      describe "google_campaign_id" do
        it "can set and get via direct methods" do
          campaign, _, _ = create_campaign(account)
          campaign.google_campaign_id = "123"
          campaign.save!

          expect(campaign.reload.google_campaign_id).to eq("123")
          expect(campaign.platform_settings["google"]["campaign_id"]).to eq("123")
        end
      end

      describe "google_status" do
        it "can set and get via direct methods" do
          campaign, _, _ = create_campaign(account)
          campaign.google_status = "ENABLED"
          campaign.save!

          expect(campaign.reload.google_status).to eq("ENABLED")
          expect(campaign.platform_settings["google"]["status"]).to eq("ENABLED")
        end
      end

      describe "google_advertising_channel_type" do
        it "can set and get via direct methods" do
          campaign, _, _ = create_campaign(account)
          campaign.google_advertising_channel_type = "SEARCH"
          campaign.save!

          expect(campaign.reload.google_advertising_channel_type).to eq("SEARCH")
          expect(campaign.platform_settings["google"]["advertising_channel_type"]).to eq("SEARCH")
        end

        it "can set via update" do
          campaign, _, _ = create_campaign(account)
          campaign.update!(google_advertising_channel_type: "DISPLAY")

          expect(campaign.reload.google_advertising_channel_type).to eq("DISPLAY")
        end

        it "is invalid with an invalid advertising_channel_type" do
          campaign, _, _ = create_campaign(account)
          campaign.google_advertising_channel_type = "INVALID"

          expect(campaign).to_not be_valid
          expect(campaign.errors[:google_advertising_channel_type]).to include("is not a valid option")
        end

        it "accepts all valid channel types" do
          campaign, _, _ = create_campaign(account)

          %w[SEARCH DISPLAY PERFORMANCE_MAX DEMAND_GEN SHOPPING MULTI_CHANNEL LOCAL HOTEL TRAVEL SMART VIDEO].each do |type|
            expect {
              campaign.google_advertising_channel_type = type
            }.not_to raise_error
          end
        end
      end

      describe "google_advertising_channel_sub_type" do
        it "can set and get" do
          campaign, _, _ = create_campaign(account)
          campaign.google_advertising_channel_type = "PERFORMANCE_MAX"
          campaign.google_advertising_channel_sub_type = "TRAVEL_ACTIVITIES"
          campaign.save!

          expect(campaign.reload.google_advertising_channel_sub_type).to eq("TRAVEL_ACTIVITIES")
        end

        it "is invalid with an invalid advertising_channel_sub_type" do
          campaign, _, _ = create_campaign(account)
          campaign.google_advertising_channel_sub_type = "INVALID"

          expect(campaign).to_not be_valid
          expect(campaign.errors[:google_advertising_channel_sub_type]).to include("is not a valid option")
        end
      end

      describe "google_valid_sub_type_for_channel_type?" do
        it "returns true for valid combinations" do
          campaign, _, _ = create_campaign(account)

          campaign.google_advertising_channel_type = "TRAVEL"
          campaign.google_advertising_channel_sub_type = "TRAVEL_ACTIVITIES"
          expect(campaign.google_valid_sub_type_for_channel_type?).to be true

          campaign.google_advertising_channel_type = "SEARCH"
          campaign.google_advertising_channel_sub_type = nil
          expect(campaign.google_valid_sub_type_for_channel_type?).to be true
        end

        it "returns false for invalid combinations" do
          campaign, _, _ = create_campaign(account)

          campaign.google_advertising_channel_type = "SEARCH"
          campaign.google_advertising_channel_sub_type = "TRAVEL_ACTIVITIES"
          expect(campaign.google_valid_sub_type_for_channel_type?).to be false
        end
      end

      describe "google_bidding_strategy" do
        it "can set and get bidding_strategy" do
          campaign, _, _ = create_campaign(account)
          campaign.google_bidding_strategy = "MAXIMIZE_CONVERSIONS"
          campaign.save!

          expect(campaign.reload.google_bidding_strategy).to eq("MAXIMIZE_CONVERSIONS")
        end
      end

      describe "google_languages" do
        it "can set and get languages" do
          campaign, _, _ = create_campaign(account)
          campaign.languages.create(google_language: "english")
          campaign.languages.create(google_language: "spanish")
          campaign.save!

          expect(campaign.reload.languages.map(&:google_language)).to eq(["english", "spanish"])
          expect(campaign.reload.languages.map(&:google_api_code)).to eq(["1000", "1003"])
        end
      end

      describe "google_budgets" do
        it "can set and get budgets" do
          campaign, _, _ = create_campaign(account)
          budget = AdBudget.create(daily_budget_cents: 1000, campaign: campaign)

          expect(campaign.reload.budget.daily_budget_cents).to eq(1000)
          budget.update!(google_budget_id: "123")
          expect(campaign.reload.budget.google_budget_id).to eq("123")
        end
      end

      describe "batch update" do
        it "updates multiple settings at once via update" do
          campaign, _, _ = create_campaign(account)
          campaign.update!(
            name: "Updated Name",
            google_advertising_channel_type: "SEARCH",
            google_bidding_strategy: "MAXIMIZE_CLICKS"
          )

          campaign.reload
          expect(campaign.name).to eq("Updated Name")
          expect(campaign.google_advertising_channel_type).to eq("SEARCH")
          expect(campaign.google_bidding_strategy).to eq("MAXIMIZE_CLICKS")
        end
      end
    end
  end

  describe "Creation" do
    it "creates ad, ad group, campaign, and chat together" do
      campaign, ad_group, ad = create_campaign(account)
      chat = Chat.find_by(
        project_id: campaign.project_id,
        chat_type: "ad_campaign",
        contextable: campaign
      )

      expect(campaign).to be_persisted
      expect(ad_group).to be_persisted
      expect(ad).to be_persisted
      expect(chat).to be_present
    end
  end

  describe "Stages" do
    describe "stage helpers" do
      it "returns correct prev_stage and next_stage" do
        campaign, _, _ = create_campaign(account)

        expect(campaign.stage).to eq("content")
        expect(campaign.prev_stage).to be_nil
        expect(campaign.next_stage).to eq("highlights")

        campaign.update_column(:stage, "highlights")
        expect(campaign.prev_stage).to eq("content")
        expect(campaign.next_stage).to eq("keywords")
      end

      it "validates prev_stage completion when advancing" do
        campaign, _, ad = create_campaign(account)

        expect(campaign.be_done_prev_stage?).to be true # first stage has no prev

        campaign.stage = "highlights"
        expect(campaign).to_not be_valid
        expect(campaign.errors[:stage]).to include("cannot advance to highlights until content stage is complete")

        create_list(:ad_headline, 3, ad: ad)
        create_list(:ad_description, 2, ad: ad)

        campaign.stage = "highlights"
        expect(campaign).to be_valid
      end
    end

    describe "valid stages" do
      it "allows all stages listed in workflow.yml" do
        expect(Campaign::STAGES).to eq(%w[content highlights keywords settings launch review])
      end
      it "validates content stage" do
        campaign, _, ad = create_campaign(account)

        expect(campaign).to_not be_done_content_stage
        expect(campaign.errors[:headlines]).to include("must have between 3-15 headlines (currently has 0)")

        create_list(:ad_headline, 3, ad: ad)
        expect(campaign).to_not be_done_content_stage
        expect(campaign.errors[:descriptions]).to include("must have between 2-4 descriptions (currently has 0)")

        create_list(:ad_description, 2, ad: ad)
        expect(campaign).to be_done_content_stage
      end

      it "validates highlights stage" do
        campaign, ad_group, _ = finish_content_stage(account)

        expect(campaign).to be_done_content_stage
        expect(campaign.stage).to eq("highlights")
        expect(campaign).to be_valid
        campaign.stage = "keywords"
        expect(campaign).to_not be_valid # You wouldn't be ALLOWED since prev stage isn't complete

        # Not done until we have callouts
        campaign.stage = "highlights"  # Reset back to highlights
        campaign.callouts.destroy_all  # Ensure no callouts
        campaign.reload
        expect(campaign.callouts.count).to eq(0)
        expect(campaign).to_not be_done_highlights_stage

        create_list(:ad_callout, 2, ad_group: ad_group, campaign: campaign)
        campaign.reload
        expect(campaign).to be_done_highlights_stage

        # if we create any structured snippets with valid values, stage is still done
        # Factory creates valid snippet with 3 values by default
        create(:ad_structured_snippet, campaign: campaign)
        campaign.reload
        expect(campaign).to be_done_highlights_stage
      end

      it "validates keywords stage" do
        campaign, ad_group, _ = finish_highlights_stage(account)

        expect(campaign).to be_done_highlights_stage
        expect(campaign.stage).to eq("keywords")
        expect(campaign).to be_valid
        campaign.stage = "settings"
        expect(campaign).to_not be_valid # You wouldn't be ALLOWED since prev stage isn't complete

        create_list(:ad_keyword, 5, ad_group: ad_group)
        expect(campaign).to be_done_keywords_stage

        campaign.ad_groups.first.keywords.destroy_all
        create_list(:ad_keyword, 15, ad_group: ad_group)
        expect(campaign).to be_done_keywords_stage

        campaign.ad_groups.first.keywords.destroy_all

        # too few keywords
        create_list(:ad_keyword, 4, ad_group: ad_group)
        expect(campaign).to_not be_done_keywords_stage
      end

      it "validates settings stage" do
        campaign, _, _ = finish_keywords_stage(account)

        expect(campaign).to be_done_keywords_stage
        expect(campaign.stage).to eq("settings")
        expect(campaign).to be_valid
        campaign.stage = "launch"
        expect(campaign).to_not be_valid # You wouldn't be ALLOWED since prev stage isn't complete

        expect(campaign).to_not be_done_settings_stage

        campaign.stage = "settings" # Reset stage before completing settings requirements
        campaign.update!(daily_budget_cents: 1000)
        campaign.update_ad_schedules(
          time_zone: "America/New_York",
          always_on: true
        )
        campaign.update_location_targets([
          {
            target_type: "geo_location",
            location_name: "United States",
            location_type: "Country",
            country_code: "US",
            geo_target_constant: "geoTargetConstants/2840",
            targeted: true
          }
        ])

        expect(campaign).to be_done_settings_stage

        # Invalidate
        campaign.update(daily_budget_cents: nil)
        campaign.reload
        expect(campaign).to_not be_done_settings_stage

        # Valid again
        campaign.update(daily_budget_cents: 1000)

        # Invalid again
        campaign.ad_schedules.destroy_all
        expect(campaign).to_not be_done_settings_stage

        # Valid again
        campaign.update_ad_schedules(
          time_zone: "America/New_York",
          always_on: true
        )

        # Invalid again
        campaign.location_targets.destroy_all
        expect(campaign).to_not be_done_settings_stage
      end

      it "validates launch stage" do
        campaign, _, _ = finish_settings_stage(account)

        expect(campaign).to be_done_settings_stage
        expect(campaign.stage).to eq("launch")
        expect(campaign).to be_valid

        expect(campaign).to_not be_done_launch_stage

        campaign.update(google_advertising_channel_type: "SEARCH")
        expect(campaign).to_not be_done_launch_stage

        campaign.update(google_bidding_strategy: "MAXIMIZE_CLICKS")
        expect(campaign).to_not be_done_launch_stage

        campaign.update(start_date: Time.zone.now, end_date: Time.zone.now + 1.month)
        expect(campaign).to be_done_launch_stage
      end
    end

    describe "deployable?" do
      it "requires google_ads_account with conversion tracking configured" do
        campaign, _, _ = finish_launch_stage(account)

        # Campaign is done with launch stage but has no google ads account
        expect(campaign).to be_done_launch_stage
        expect(campaign).to_not be_deployable

        # Create a google ads account without conversion tracking
        ads_account = AdsAccount.create!(account: account, platform: "google")
        ads_account.update!(google_customer_id: "1234567890")

        # Still not deployable - missing conversion tracking
        expect(campaign.reload).to_not be_deployable

        # Add conversion_id but not label
        ads_account.update!(google_conversion_id: "AW-123456789")
        expect(campaign.reload).to_not be_deployable

        # Add conversion_label - now deployable
        ads_account.update!(google_conversion_label: "abc123XYZ")
        expect(campaign.reload).to be_deployable
      end

      it "is not deployable without completing launch stage" do
        campaign, _, _ = finish_settings_stage(account)

        # Create a fully configured google ads account
        ads_account = AdsAccount.create!(account: account, platform: "google")
        ads_account.update!(
          google_customer_id: "1234567890",
          google_conversion_id: "AW-123456789",
          google_conversion_label: "abc123XYZ"
        )

        # Campaign still in settings stage, not deployable
        expect(campaign.stage).to eq("launch")
        expect(campaign).to_not be_done_launch_stage
        expect(campaign.reload).to_not be_deployable
      end
    end

    describe "Content" do
      it "allows saving any partial headlines and descriptions" do
        campaign, _, _ = create_campaign(account)

        campaign.update_column(:stage, "highlights")
        expect(campaign.stage).to eq("highlights")
      end
    end
  end
end
