require 'rails_helper'

RSpec.describe CampaignConcerns::Updating, "Updating campaigns + campaign assets", type: :model do
  include PlanHelpers
  include SubscriptionHelpers
  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let!(:template) { create(:template) }
  let!(:project) do
    data = Brainstorm.create_brainstorm!(account, name: "Project", thread_id: "thread_id")
    data[:project]
  end
  let!(:website) { project.website }
  let!(:campaign) do
    result = Campaign.create_campaign!(account, {
      name: "Test Campaign",
      project_id: project.id,
      website_id: website.id
    })
    result[:campaign]
  end
  let!(:campaign2) do
    result = Campaign.create_campaign!(account, {
      name: "Test Campaign 2",
      project_id: project.id,
      website_id: website.id
    })
    result[:campaign]
  end
  let(:ad_group) { campaign.ad_groups.first }
  let(:ad) { ad_group.ads.first }

  before do
    ensure_plans_exist
    subscribe_account(account, plan_name: 'pro')
  end

  describe "headlines soft delete" do
    let!(:headline1) { create(:ad_headline, ad: ad, text: "Headline 1", position: 0) }
    let!(:headline2) { create(:ad_headline, ad: ad, text: "Headline 2", position: 1) }
    let!(:headline3) { create(:ad_headline, ad: ad, text: "Headline 3", position: 2) }

    it "soft deletes headlines not in the update by setting deleted_at" do
      campaign.update_idempotently!(
        headlines: [
          { text: "Headline 2 Updated" }
        ]
      )

      headline1.reload
      headline2.reload
      headline3.reload

      expect(headline1.deleted_at).to be_nil
      expect(headline2.deleted_at).to be_present
      expect(headline3.deleted_at).to be_present

      expect(ad.headlines.count).to eq(1)
      expect(ad.headlines.first.text).to eq("Headline 2 Updated")
      expect(ad.headlines.first.position).to eq(0)
      expect(ad.headlines.first.id).to eq(headline1.id)
    end

    it "reifies a soft-deleted headline when same position is used" do
      campaign.update_idempotently!(
        headlines: [
          { text: "Headline 1" }
        ]
      )

      headline2.reload
      headline3.reload
      expect(headline2.deleted_at).to be_present
      expect(headline3.deleted_at).to be_present

      campaign.update_idempotently!(
        headlines: [
          { text: "Headline 1" },
          { text: "Reified Headline" }
        ]
      )

      headline2.reload
      expect(headline2.deleted_at).to be_nil
      expect(headline2.text).to eq("Reified Headline")
      expect(headline2.position).to eq(1)

      expect(AdHeadline.unscoped.where(ad_id: ad.id).count).to eq(3)
    end

    it "does not create new records when reifying existing soft-deleted ones" do
      initial_count = AdHeadline.unscoped.where(ad_id: ad.id).count

      campaign.update_idempotently!(
        headlines: []
      )

      expect(AdHeadline.unscoped.where(ad_id: ad.id).count).to eq(initial_count)
      expect(ad.headlines.count).to eq(0)

      campaign.update_idempotently!(
        headlines: [
          { text: "New Headline 1" },
          { text: "New Headline 2" },
          { text: "New Headline 3" }
        ]
      )

      expect(AdHeadline.unscoped.where(ad_id: ad.id).count).to eq(initial_count)
      expect(ad.headlines.count).to eq(3)

      reified_headlines = ad.headlines.order(:position)
      expect(reified_headlines.pluck(:id)).to match_array([headline1.id, headline2.id, headline3.id])
    end
  end

  describe "descriptions soft delete" do
    let!(:description1) { create(:ad_description, ad: ad, text: "Description 1", position: 0) }
    let!(:description2) { create(:ad_description, ad: ad, text: "Description 2", position: 1) }

    it "soft deletes descriptions not in the update by setting deleted_at" do
      campaign.update_idempotently!(
        descriptions: [
          { text: "Description 1 Updated" }
        ]
      )

      description1.reload
      description2.reload

      expect(description1.deleted_at).to be_nil
      expect(description2.deleted_at).to be_present

      expect(ad.descriptions.count).to eq(1)
    end

    it "reifies a soft-deleted description when same position is used" do
      campaign.update_idempotently!(
        descriptions: []
      )

      description1.reload
      description2.reload
      expect(description1.deleted_at).to be_present
      expect(description2.deleted_at).to be_present

      campaign.update_idempotently!(
        descriptions: [
          { text: "Reified Description" }
        ]
      )

      description1.reload
      expect(description1.deleted_at).to be_nil
      expect(description1.text).to eq("Reified Description")
    end
  end

  describe "keywords soft delete" do
    let!(:keyword1) { create(:ad_keyword, ad_group: ad_group, text: "keyword1", match_type: "broad", position: 0) }
    let!(:keyword2) { create(:ad_keyword, ad_group: ad_group, text: "keyword2", match_type: "phrase", position: 1) }

    it "soft deletes keywords not in the update by setting deleted_at" do
      campaign.update_idempotently!(
        keywords: [
          { text: "keyword1", match_type: "broad" }
        ]
      )

      keyword1.reload
      keyword2.reload

      expect(keyword1.deleted_at).to be_nil
      expect(keyword2.deleted_at).to be_present

      expect(ad_group.keywords.count).to eq(1)
    end

    it "reifies a soft-deleted keyword when same position is used" do
      campaign.update_idempotently!(
        keywords: []
      )

      keyword1.reload
      keyword2.reload
      expect(keyword1.deleted_at).to be_present
      expect(keyword2.deleted_at).to be_present

      campaign.update_idempotently!(
        keywords: [
          { text: "reified_keyword", match_type: "exact" }
        ]
      )

      keyword1.reload
      expect(keyword1.deleted_at).to be_nil
      expect(keyword1.text).to eq("reified_keyword")
      expect(keyword1.match_type).to eq("exact")
    end
  end

  describe "callouts soft delete" do
    let!(:callout1) { create(:ad_callout, campaign: campaign, ad_group: ad_group, text: "Callout 1", position: 0) }
    let!(:callout2) { create(:ad_callout, campaign: campaign, ad_group: ad_group, text: "Callout 2", position: 1) }

    it "soft deletes callouts not in the update by setting deleted_at" do
      campaign.update_idempotently!(
        callouts: [
          { text: "Callout 1 Updated" }
        ]
      )

      callout1.reload
      callout2.reload

      expect(callout1.deleted_at).to be_nil
      expect(callout2.deleted_at).to be_present

      expect(campaign.callouts.count).to eq(1)
    end

    it "reifies a soft-deleted callout when same position is used" do
      campaign.update_idempotently!(
        callouts: []
      )

      callout1.reload
      callout2.reload
      expect(callout1.deleted_at).to be_present
      expect(callout2.deleted_at).to be_present

      campaign.update_idempotently!(
        callouts: [
          { text: "Reified Callout" }
        ]
      )

      callout1.reload
      expect(callout1.deleted_at).to be_nil
      expect(callout1.text).to eq("Reified Callout")
    end
  end

  describe "default scope excludes soft-deleted records" do
    let!(:headline1) { create(:ad_headline, ad: ad, text: "Active", position: 0) }
    let!(:headline2) { create(:ad_headline, ad: ad, text: "Deleted", position: 1, deleted_at: Time.current) }

    it "excludes soft-deleted records from default queries" do
      expect(ad.headlines).to include(headline1)
      expect(ad.headlines).not_to include(headline2)
    end

    it "includes soft-deleted records when using unscoped" do
      expect(AdHeadline.unscoped.where(ad_id: ad.id)).to include(headline1)
      expect(AdHeadline.unscoped.where(ad_id: ad.id)).to include(headline2)
    end

    it "provides a deleted scope to query only soft-deleted records" do
      expect(AdHeadline.deleted.where(ad_id: ad.id)).not_to include(headline1)
      expect(AdHeadline.deleted.where(ad_id: ad.id)).to include(headline2)
    end
  end

  describe "index stability" do
    let!(:headlines) do
      (0..14).map do |i|
        create(:ad_headline, ad: ad, text: "Headline #{i}", position: i)
      end
    end

    it "maintains stable record count when repeatedly soft-deleting and reifying" do
      initial_total = AdHeadline.unscoped.where(ad_id: ad.id).count

      3.times do
        campaign.update_idempotently!(
          headlines: headlines.first(5).map.with_index do |h, i|
            { text: h.text }
          end
        )

        campaign.update_idempotently!(
          headlines: (0..14).map do |i|
            { text: "Headline #{i}", position: i }
          end
        )
      end

      expect(AdHeadline.unscoped.where(ad_id: ad.id).count).to eq(initial_total)
    end
  end

  describe "nested params still work for backwards compatibility" do
    let!(:headline1) { create(:ad_headline, ad: ad, text: "Headline 1", position: 0) }

    it "accepts the legacy nested _attributes format" do
      campaign.update_idempotently!(
        ad_groups_attributes: [
          {
            id: ad_group.id,
            ads_attributes: [
              {
                id: ad.id,
                headlines_attributes: [
                  { text: "Legacy Format Works" }
                ]
              }
            ]
          }
        ]
      )

      expect(ad.headlines.first.text).to eq("Legacy Format Works")
    end
  end

  describe "location_targets id stability" do
    let!(:location1) do
      create(:ad_location_target, campaign: campaign, location_name: "United States", country_code: "US",
        platform_settings: { "google" => { "criterion_id" => "geoTargetConstants/2840" } })
    end
    let!(:location2) do
      create(:ad_location_target, campaign: campaign, location_name: "California", country_code: "US",
        platform_settings: { "google" => { "criterion_id" => "geoTargetConstants/21137" } })
    end
    let!(:location3) do
      create(:ad_location_target, campaign: campaign2, location_name: "Texas", country_code: "US",
        platform_settings: { "google" => { "criterion_id" => "geoTargetConstants/21138" } })
    end

    it "preserves ids when updating location targets with same data" do
      original_ids = [location1.id, location2.id]

      campaign.update_idempotently!(
        location_targets: [
          { geo_target_constant: "geoTargetConstants/2840", location_name: "United States", country_code: "US", target_type: "geo_location" },
          { geo_target_constant: "geoTargetConstants/21137", location_name: "California", country_code: "US", target_type: "geo_location" }
        ]
      )

      campaign.reload
      expect(campaign.location_targets.pluck(:id).sort).to eq(original_ids.sort)
    end

    it "soft deletes location targets not in the update" do
      campaign.update_idempotently!(
        location_targets: [
          { geo_target_constant: "geoTargetConstants/2840", location_name: "United States", country_code: "US", target_type: "geo_location" }
        ]
      )

      location1.reload
      location2.reload

      expect(location1.deleted_at).to be_nil
      expect(location2.deleted_at).to be_present
      expect(campaign.location_targets.count).to eq(1)
    end

    it "reifies soft-deleted location targets when needed" do
      campaign.update_idempotently!(
        location_targets: [
          { geo_target_constant: "geoTargetConstants/2840", location_name: "United States", country_code: "US", target_type: "geo_location" }
        ]
      )

      expect(campaign.location_targets.count).to eq(1)

      campaign.update_idempotently!(
        location_targets: [
          { geo_target_constant: "geoTargetConstants/2840", location_name: "United States", country_code: "US", target_type: "geo_location" },
          { geo_target_constant: "geoTargetConstants/21137", location_name: "California", country_code: "US", target_type: "geo_location" }
        ]
      )

      location2.reload
      expect(location2.deleted_at).to be_nil
      expect(campaign.location_targets.count).to eq(2)
    end

    it "does not affect location targets from other campaigns" do
      expect {
        campaign.update_idempotently!(
          location_targets: [
            { geo_target_constant: "geoTargetConstants/2840", location_name: "United States", country_code: "US", target_type: "geo_location" },
            { geo_target_constant: "geoTargetConstants/21138", location_name: "Texas", country_code: "US", target_type: "geo_location" },
            { geo_target_constant: "geoTargetConstants/21139", location_name: "Florida", country_code: "US", target_type: "geo_location" }
          ]
        )
      }.not_to change { campaign2.location_targets.count }
      last_target = campaign.location_targets.order(:id).last
      expect(last_target.id).to be > location3.id

      expect {
        campaign.update_idempotently!(
          location_targets: []
        )
      }.not_to change { campaign2.location_targets.count }

      expect(campaign.location_targets.count).to eq(0)
      expect(campaign2.location_targets.count).to eq(1)

      expect {
        campaign.update_idempotently!(
          location_targets: [
            { geo_target_constant: "geoTargetConstants/2840", location_name: "United States", country_code: "US", target_type: "geo_location" },
            { geo_target_constant: "geoTargetConstants/21138", location_name: "Texas", country_code: "US", target_type: "geo_location" },
            { geo_target_constant: "geoTargetConstants/21139", location_name: "Florida", country_code: "US", target_type: "geo_location" }
          ]
        )
      }.not_to change { campaign2.location_targets.count }

      # Even though we keep updating campaign1, we never create new location targets for either campaign
      last_target = campaign.location_targets.order(:id).last
      expect(last_target.id).to be > location3.id
      expect(campaign.location_targets.count).to eq(3)
      expect(campaign2.location_targets.count).to eq(1)
    end

    it "does not create new records when reifying existing soft-deleted ones" do
      initial_count = AdLocationTarget.unscoped.where(campaign_id: campaign.id).count

      campaign.update_idempotently!(location_targets: [])

      expect(AdLocationTarget.unscoped.where(campaign_id: campaign.id).count).to eq(initial_count)
      expect(campaign.location_targets.count).to eq(0)

      campaign.update_idempotently!(
        location_targets: [
          { geo_target_constant: "geoTargetConstants/2840", location_name: "United States", country_code: "US", target_type: "geo_location" },
          { geo_target_constant: "geoTargetConstants/21137", location_name: "California", country_code: "US", target_type: "geo_location" }
        ]
      )

      expect(AdLocationTarget.unscoped.where(campaign_id: campaign.id).count).to eq(initial_count)
      expect(campaign.location_targets.count).to eq(2)
      expect(campaign.location_targets.pluck(:id)).to match_array([location1.id, location2.id])
    end

    it "handles adding new locations beyond existing slots" do
      initial_count = AdLocationTarget.unscoped.where(campaign_id: campaign.id).count

      campaign.update_idempotently!(
        location_targets: [
          { geo_target_constant: "geoTargetConstants/2840", location_name: "United States", country_code: "US", target_type: "geo_location" },
          { geo_target_constant: "geoTargetConstants/21137", location_name: "California", country_code: "US", target_type: "geo_location" },
          { geo_target_constant: "geoTargetConstants/1014221", location_name: "New York", country_code: "US", target_type: "geo_location" }
        ]
      )

      expect(campaign.location_targets.count).to eq(3)
      expect(AdLocationTarget.unscoped.where(campaign_id: campaign.id).count).to eq(initial_count + 1)
    end
  end
end
