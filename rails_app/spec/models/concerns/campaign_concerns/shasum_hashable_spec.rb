require "rails_helper"

RSpec.describe "CampaignConcerns::ShasumHashable" do
  let(:account) { create(:account) }
  let(:project) { create(:project, account: account) }
  let(:website) { create(:website, project: project, account: account) }
  let(:campaign) { create(:campaign, account: account, project: project, website: website) }

  describe "#generate_shasum" do
    it "generates a SHA256 hex string" do
      shasum = campaign.generate_shasum
      expect(shasum).to match(/\A[0-9a-f]{64}\z/)
    end

    it "generates the same shasum for the same data" do
      expect(campaign.generate_shasum).to eq(campaign.generate_shasum)
    end

    it "changes when campaign name changes" do
      original = campaign.generate_shasum
      campaign.update!(name: "New Name")
      expect(campaign.generate_shasum).not_to eq(original)
    end

    it "changes when budget changes" do
      create(:ad_budget, campaign: campaign, daily_budget_cents: 500)
      original = campaign.generate_shasum

      campaign.budget.update!(daily_budget_cents: 1000)
      expect(campaign.generate_shasum).not_to eq(original)
    end

    it "changes when a keyword is added" do
      ad_group = create(:ad_group, campaign: campaign)
      create(:ad_keyword, ad_group: ad_group, text: "test keyword", position: 0)
      original = campaign.reload.generate_shasum

      create(:ad_keyword, ad_group: ad_group, text: "new keyword", position: 1)
      expect(campaign.reload.generate_shasum).not_to eq(original)
    end

    it "changes when ad headline text changes" do
      ad_group = create(:ad_group, campaign: campaign)
      ad = create(:ad, ad_group: ad_group)
      headline = create(:ad_headline, ad: ad, text: "Original", position: 0)
      original = campaign.reload.generate_shasum

      headline.update!(text: "Updated")
      expect(campaign.reload.generate_shasum).not_to eq(original)
    end

    it "changes when location target is added" do
      original = campaign.generate_shasum
      create(:ad_location_target, campaign: campaign)
      expect(campaign.reload.generate_shasum).not_to eq(original)
    end

    it "changes when schedule is added" do
      original = campaign.generate_shasum
      create(:ad_schedule, campaign: campaign, day_of_week: "Monday", start_hour: 9, start_minute: 0, end_hour: 17, end_minute: 0)
      expect(campaign.reload.generate_shasum).not_to eq(original)
    end

    it "changes when callout is added" do
      ad_group = create(:ad_group, campaign: campaign)
      original = campaign.reload.generate_shasum
      create(:ad_callout, campaign: campaign, ad_group: ad_group, text: "Free shipping", position: 0)
      expect(campaign.reload.generate_shasum).not_to eq(original)
    end

    it "changes when structured snippet is added" do
      original = campaign.generate_shasum
      create(:ad_structured_snippet, campaign: campaign, category: "brands", values: ["A", "B", "C"])
      expect(campaign.reload.generate_shasum).not_to eq(original)
    end

    it "does not change when platform_settings change" do
      ad_group = create(:ad_group, campaign: campaign)
      original = campaign.reload.generate_shasum

      ad_group.update!(platform_settings: { "google" => { "ad_group_id" => "12345" } })
      expect(campaign.reload.generate_shasum).to eq(original)
    end

    it "is deterministic regardless of query order" do
      ad_group = create(:ad_group, campaign: campaign)
      create(:ad_keyword, ad_group: ad_group, text: "keyword 1", position: 0)
      create(:ad_keyword, ad_group: ad_group, text: "keyword 2", position: 1)

      shasum1 = campaign.reload.generate_shasum
      shasum2 = campaign.reload.generate_shasum
      expect(shasum1).to eq(shasum2)
    end
  end

  describe "#campaign_changed?" do
    context "with no deploys" do
      it "returns true" do
        expect(campaign.campaign_changed?).to be true
      end
    end

    context "with a completed deploy" do
      let!(:deploy) { create(:campaign_deploy, campaign: campaign, status: "completed", shasum: campaign.generate_shasum) }

      it "returns false when campaign has not changed" do
        expect(campaign.campaign_changed?).to be false
      end

      it "returns true when campaign data has changed" do
        campaign.update!(name: "Changed Name")
        expect(campaign.campaign_changed?).to be true
      end
    end

    context "with multiple deploys" do
      let!(:old_deploy) { create(:campaign_deploy, campaign: campaign, status: "completed", shasum: "old", created_at: 2.days.ago) }
      let!(:latest_deploy) { create(:campaign_deploy, campaign: campaign, status: "completed", shasum: campaign.generate_shasum, created_at: 1.day.ago) }
      let!(:failed_deploy) { create(:campaign_deploy, campaign: campaign, status: "failed", shasum: "failed", created_at: 1.hour.ago) }

      it "compares against the latest completed deploy" do
        expect(campaign.campaign_changed?).to be false
      end

      it "ignores failed deploys" do
        expect(campaign.campaign_deploys.completed.order(created_at: :desc).first).to eq(latest_deploy)
      end

      it "detects changes after the latest completed deploy" do
        campaign.update!(name: "Changed Name")
        expect(campaign.campaign_changed?).to be true
      end
    end
  end
end
