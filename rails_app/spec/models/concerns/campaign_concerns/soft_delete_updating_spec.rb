require 'rails_helper'

RSpec.describe CampaignConcerns::Updating, "soft delete behavior", type: :model do
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
        ad_groups_attributes: [
          {
            id: ad_group.id,
            ads_attributes: [
              {
                id: ad.id,
                headlines_attributes: [
                  { text: "Headline 1 Updated" }
                ]
              }
            ]
          }
        ]
      )

      headline1.reload
      headline2.reload
      headline3.reload

      expect(headline1.deleted_at).to be_nil
      expect(headline1.text).to eq("Headline 1 Updated")
      expect(headline2.deleted_at).to be_present
      expect(headline3.deleted_at).to be_present

      expect(ad.headlines.count).to eq(1)
    end

    it "reifies a soft-deleted headline when same position is used" do
      campaign.update_idempotently!(
        ad_groups_attributes: [
          {
            id: ad_group.id,
            ads_attributes: [
              {
                id: ad.id,
                headlines_attributes: [
                  { text: "Only Headline 0" }
                ]
              }
            ]
          }
        ]
      )

      headline1.reload
      headline2.reload
      headline3.reload
      expect(headline1.deleted_at).to be_nil
      expect(headline2.deleted_at).to be_present
      expect(headline3.deleted_at).to be_present

      campaign.update_idempotently!(
        ad_groups_attributes: [
          {
            id: ad_group.id,
            ads_attributes: [
              {
                id: ad.id,
                headlines_attributes: [
                  { text: "Headline 0 Again" },
                  { text: "Reified Headline at position 1" }
                ]
              }
            ]
          }
        ]
      )

      headline1.reload
      headline2.reload
      expect(headline1.deleted_at).to be_nil
      expect(headline2.deleted_at).to be_nil
      expect(headline2.text).to eq("Reified Headline at position 1")
      expect(headline2.position).to eq(1)

      expect(AdHeadline.unscoped.where(ad_id: ad.id).count).to eq(3)
    end

    it "does not create new records when reifying existing soft-deleted ones" do
      initial_count = AdHeadline.unscoped.where(ad_id: ad.id).count

      campaign.update_idempotently!(
        ad_groups_attributes: [
          {
            id: ad_group.id,
            ads_attributes: [
              {
                id: ad.id,
                headlines_attributes: []
              }
            ]
          }
        ]
      )

      expect(AdHeadline.unscoped.where(ad_id: ad.id).count).to eq(initial_count)
      expect(ad.headlines.count).to eq(0)

      campaign.update_idempotently!(
        ad_groups_attributes: [
          {
            id: ad_group.id,
            ads_attributes: [
              {
                id: ad.id,
                headlines_attributes: [
                  { text: "New Headline 1" },
                  { text: "New Headline 2" },
                  { text: "New Headline 3" }
                ]
              }
            ]
          }
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
        ad_groups_attributes: [
          {
            id: ad_group.id,
            ads_attributes: [
              {
                id: ad.id,
                descriptions_attributes: [
                  { text: "Description 1 Updated" }
                ]
              }
            ]
          }
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
        ad_groups_attributes: [
          {
            id: ad_group.id,
            ads_attributes: [
              {
                id: ad.id,
                descriptions_attributes: []
              }
            ]
          }
        ]
      )

      description1.reload
      description2.reload
      expect(description1.deleted_at).to be_present
      expect(description2.deleted_at).to be_present

      campaign.update_idempotently!(
        ad_groups_attributes: [
          {
            id: ad_group.id,
            ads_attributes: [
              {
                id: ad.id,
                descriptions_attributes: [
                  { text: "Reified Description" }
                ]
              }
            ]
          }
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
        ad_groups_attributes: [
          {
            id: ad_group.id,
            keywords_attributes: [
              { text: "keyword1", match_type: "broad" }
            ]
          }
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
        ad_groups_attributes: [
          {
            id: ad_group.id,
            keywords_attributes: []
          }
        ]
      )

      keyword1.reload
      keyword2.reload
      expect(keyword1.deleted_at).to be_present
      expect(keyword2.deleted_at).to be_present

      campaign.update_idempotently!(
        ad_groups_attributes: [
          {
            id: ad_group.id,
            keywords_attributes: [
              { text: "reified_keyword", match_type: "exact" }
            ]
          }
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
        callouts_attributes: [
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
        callouts_attributes: []
      )

      callout1.reload
      callout2.reload
      expect(callout1.deleted_at).to be_present
      expect(callout2.deleted_at).to be_present

      campaign.update_idempotently!(
        callouts_attributes: [
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
      expect(AdHeadline.only_deleted.where(ad_id: ad.id)).not_to include(headline1)
      expect(AdHeadline.only_deleted.where(ad_id: ad.id)).to include(headline2)
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
          ad_groups_attributes: [
            {
              id: ad_group.id,
              ads_attributes: [
                {
                  id: ad.id,
                  headlines_attributes: (0..4).map do |i|
                    { text: "Headline #{i}" }
                  end
                }
              ]
            }
          ]
        )

        campaign.update_idempotently!(
          ad_groups_attributes: [
            {
              id: ad_group.id,
              ads_attributes: [
                {
                  id: ad.id,
                  headlines_attributes: (0..14).map do |i|
                    { text: "Headline #{i}" }
                  end
                }
              ]
            }
          ]
        )
      end

      expect(AdHeadline.unscoped.where(ad_id: ad.id).count).to eq(initial_total)
    end
  end
end
