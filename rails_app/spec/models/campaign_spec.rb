# == Schema Information
#
# Table name: campaigns
#
#  id                 :bigint           not null, primary key
#  daily_budget_cents :integer
#  launched_at        :datetime
#  name               :string
#  stage              :string           default("content")
#  status             :string           default("draft")
#  time_zone          :string           default("America/New_York")
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint
#  project_id         :bigint
#  website_id         :bigint
#
# Indexes
#
#  index_campaigns_on_account_id             (account_id)
#  index_campaigns_on_account_id_and_stage   (account_id,stage)
#  index_campaigns_on_account_id_and_status  (account_id,status)
#  index_campaigns_on_created_at             (created_at)
#  index_campaigns_on_launched_at            (launched_at)
#  index_campaigns_on_project_id             (project_id)
#  index_campaigns_on_project_id_and_stage   (project_id,stage)
#  index_campaigns_on_project_id_and_status  (project_id,status)
#  index_campaigns_on_stage                  (stage)
#  index_campaigns_on_status                 (status)
#  index_campaigns_on_website_id             (website_id)
#
require 'rails_helper'

RSpec.describe Campaign, type: :model do
  let(:account) { create(:account) }
  let(:website) { create(:website, account: account) }

  def create_campaign
    created_records = Campaign.create_campaign!(account, {
      name: "Test Campaign",
      website_id: website.id,
      project_id: website.project.id
    })
    [created_records[:campaign], created_records[:ad_group], created_records[:ad]]
  end

  def finish_content_stage
    campaign, ad_group, ad = create_campaign
    create_list(:ad_headline, 3, ad: ad)
    create_list(:ad_description, 2, ad: ad)
    campaign.advance_stage!

    [campaign, ad_group, ad]
  end

  def finish_highlights_stage
    campaign, ad_group, ad = finish_content_stage
    create_list(:ad_callout, 2, ad_group: ad_group, campaign: campaign)
    campaign.advance_stage!

    [campaign, ad_group, ad]
  end

  def finish_keywords_stage
    campaign, ad_group, ad = finish_highlights_stage
    create_list(:ad_keyword, 5, ad_group: ad_group)
    campaign.advance_stage!

    [campaign, ad_group, ad]
  end

  def finish_settings_stage
    campaign, ad_group, ad = finish_keywords_stage

    campaign.update_column(:daily_budget_cents, 1000)
    campaign.update_ad_schedules(
      time_zone: "America/New_York",
      always_on: true
    )
    campaign.update_location_targets([
      {
        target_type: "geo_location",
        location_name: "United States",
        location_type: "COUNTRY",
        country_code: "US",
        geo_target_constant: "geoTargetConstants/2840",
        targeted: true,
        radius: 10,
        radius_units: "miles"
      }
    ])
  end

  describe "validations" do
    it { should validate_presence_of(:status) }
    it { should validate_inclusion_of(:status).in_array(Campaign::STATUSES) }
    it { should validate_presence_of(:stage) }
    it { should validate_inclusion_of(:stage).in_array(Campaign::STAGES) }
  end

  describe "nested attributes" do
    it { should accept_nested_attributes_for(:ad_groups).allow_destroy(true) }
    it { should accept_nested_attributes_for(:callouts).allow_destroy(true) }
    it { should accept_nested_attributes_for(:structured_snippets).allow_destroy(true) }
  end

  describe "Creation" do
    it "creates ad, ad group, and campaign together" do
      campaign, ad_group, ad = create_campaign

      expect(campaign).to be_persisted
      expect(ad_group).to be_persisted
      expect(ad).to be_persisted
    end
  end

  describe "Stages" do
    describe "stage helpers" do
      it "returns correct prev_stage and next_stage" do
        campaign, _, _ = create_campaign

        expect(campaign.stage).to eq("content")
        expect(campaign.prev_stage).to be_nil
        expect(campaign.next_stage).to eq("highlights")

        campaign.update_column(:stage, "highlights")
        expect(campaign.prev_stage).to eq("content")
        expect(campaign.next_stage).to eq("keywords")
      end

      it "validates prev_stage completion when advancing" do
        campaign, _, ad = create_campaign

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
        expect(Campaign::STAGES).to eq(%w[content highlights keywords settings launch])
      end
      it "validates content stage" do
        campaign, _, ad = create_campaign

        expect(campaign).to_not be_done_content_stage
        expect(campaign.errors[:headlines]).to include("must have between 3-15 headlines (currently has 0)")

        create_list(:ad_headline, 3, ad: ad)
        expect(campaign).to_not be_done_content_stage
        expect(campaign.errors[:descriptions]).to include("must have between 2-4 descriptions (currently has 0)")

        create_list(:ad_description, 2, ad: ad)
        expect(campaign).to be_done_content_stage
      end

      it "validates highlights stage" do
        campaign, ad_group, _ = finish_content_stage

        expect(campaign).to be_done_content_stage
        campaign.advance_stage!
        expect(campaign.stage).to eq("highlights")
        expect(campaign).to be_valid
        campaign.stage = "keywords"
        expect(campaign).to_not be_valid # You wouldn't be ALLOWED since prev stage isn't complete

        # expect(campaign).to_not be_done_highlights_stage
        create_list(:ad_callout, 2, ad_group: ad_group, campaign: campaign)
        expect(campaign).to be_done_highlights_stage

        # if we create any structured snippets, we re-validate
        create(:ad_structured_snippet, campaign: campaign)
        campaign.reload
        expect(campaign).to be_done_highlights_stage
        snippet = campaign.structured_snippet

        # Create an invalid snippet
        snippet.update(values: ["a"])
        expect(campaign).to_not be_done_highlights_stage

        snippet.update(values: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"]) # too long
        campaign.reload
        expect(campaign).to_not be_done_highlights_stage

        snippet.update(values: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]) # just right
        campaign.reload
        expect(campaign).to be_done_highlights_stage
      end

      it "validates keywords stage" do
        campaign, ad_group, _ = finish_highlights_stage

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
        campaign, _, _ = finish_keywords_stage

        expect(campaign).to be_done_keywords_stage
        expect(campaign.stage).to eq("settings")
        expect(campaign).to be_valid
        campaign.stage = "launch"
        expect(campaign).to_not be_valid # You wouldn't be ALLOWED since prev stage isn't complete

        expect(campaign).to_not be_done_settings_stage

        campaign.update_column(:daily_budget_cents, 1000)
        campaign.update_ad_schedules(
          time_zone: "America/New_York",
          always_on: true
        )
        campaign.update_location_targets([
          {
            target_type: "geo_location",
            location_name: "United States",
            location_type: "COUNTRY",
            country_code: "US",
            geo_target_constant: "geoTargetConstants/2840",
            targeted: true,
            radius: 10,
            radius_units: "miles"
          }
        ])

        expect(campaign).to be_done_settings_stage

        # Invalidate
        campaign.update_column(:daily_budget_cents, nil)
        expect(campaign).to_not be_done_settings_stage

        # Valid again
        campaign.update_column(:daily_budget_cents, 1000)

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
    end

    describe "Content" do
      it "allows saving any partial headlines and descriptions" do
        campaign, _, _ = create_campaign

        campaign.update_column(:stage, "highlights")
        expect(campaign.stage).to eq("highlights")
      end
    end
  end
end
