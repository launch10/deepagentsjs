require "rails_helper"

RSpec.describe Deploys::FullResetService do
  let!(:user) { create(:user) }
  let!(:account) { user.owned_account }
  let!(:project) { create(:project, account: account) }
  let!(:website) { create(:website, project: project, account: account) }
  let!(:deploy) { create(:deploy, project: project, status: "completed") }

  let!(:connected_account) do
    create(:connected_account, owner: user, provider: "google_oauth2")
  end

  let!(:ads_account) do
    create(:ads_account, account: account, platform: "google").tap do |aa|
      aa.google_customer_id = "1234567890"
      aa.save!
    end
  end

  let!(:invitation) do
    create(:ads_account_invitation, :accepted, ads_account: ads_account, email_address: user.email)
  end

  let!(:campaign) do
    create(:campaign, account: account, project: project, website: website).tap do |c|
      c.google_campaign_id = "campaign_123"
      c.google_status = "PAUSED"
      c.save!
    end
  end

  let!(:ad_budget) do
    create(:ad_budget, campaign: campaign).tap do |b|
      b.google_budget_id = "budget_123"
      b.save!
    end
  end

  let!(:ad_group) do
    create(:ad_group, campaign: campaign).tap do |ag|
      ag.google_ad_group_id = "adgroup_123"
      ag.google_status = "PAUSED"
      ag.save!
    end
  end

  let!(:ad) do
    create(:ad, ad_group: ad_group).tap do |a|
      a.google_ad_id = "ad_123"
      a.save!
    end
  end

  let!(:keyword) do
    create(:ad_keyword, ad_group: ad_group).tap do |kw|
      kw.google_criterion_id = "criterion_123"
      kw.save!
    end
  end

  let!(:campaign_deploy) { create(:campaign_deploy, campaign: campaign) }

  before do
    # Stub Google API calls
    allow_any_instance_of(Campaign).to receive(:google_delete)
    allow(account).to receive(:dangerously_destroy_google_ads_account!).and_return(true)
    allow_any_instance_of(GoogleAds::Resources::AccountInvitation).to receive(:upgrade_access_role)

    # Stub Langgraph thread deletion
    langgraph_client = instance_double(LanggraphClient)
    allow(LanggraphClient).to receive(:new).and_return(langgraph_client)
    allow(langgraph_client).to receive(:delete)
  end

  describe "#call" do
    it "upgrades accepted invitation access role to ADMIN" do
      syncer = instance_double(GoogleAds::Resources::AccountInvitation)
      allow(GoogleAds::Resources::AccountInvitation).to receive(:new).with(invitation).and_return(syncer)
      expect(syncer).to receive(:upgrade_access_role).with(:ADMIN)

      described_class.new(deploy).call
    end

    it "does not raise if upgrade access role fails" do
      allow_any_instance_of(GoogleAds::Resources::AccountInvitation)
        .to receive(:upgrade_access_role).and_raise(StandardError, "API error")

      expect { described_class.new(deploy).call }.not_to raise_error
    end

    it "soft-deletes the deploy" do
      expect { described_class.new(deploy).call }.to change { Deploy.count }.by(-1)
      expect(deploy.reload.deleted_at).to be_present
    end

    it "destroys the AdsAccount and its invitations" do
      described_class.new(deploy).call

      expect(AdsAccount.find_by(id: ads_account.id)).to be_nil
      expect(AdsAccountInvitation.find_by(id: invitation.id)).to be_nil
    end

    it "destroys the Google OAuth ConnectedAccount" do
      described_class.new(deploy).call

      expect(ConnectedAccount.find_by(id: connected_account.id)).to be_nil
    end

    it "clears google IDs from campaign" do
      described_class.new(deploy).call

      campaign.reload
      expect(campaign.google_campaign_id).to be_nil
      expect(campaign.platform_settings.dig("google", "status")).to be_nil
    end

    it "clears google IDs from ad group, ad, keyword, and budget" do
      described_class.new(deploy).call

      ad_group.reload
      expect(ad_group.google_ad_group_id).to be_nil
      expect(ad_group.platform_settings.dig("google", "status")).to be_nil

      ad.reload
      expect(ad.google_ad_id).to be_nil

      keyword.reload
      expect(keyword.google_criterion_id).to be_nil

      ad_budget.reload
      expect(ad_budget.google_budget_id).to be_nil
    end

    it "preserves campaign content (name, ad group names, keyword text)" do
      campaign_name = campaign.name
      ad_group_name = ad_group.name
      keyword_text = keyword.text
      budget_cents = ad_budget.daily_budget_cents

      described_class.new(deploy).call

      expect(campaign.reload.name).to eq(campaign_name)
      expect(ad_group.reload.name).to eq(ad_group_name)
      expect(keyword.reload.text).to eq(keyword_text)
      expect(ad_budget.reload.daily_budget_cents).to eq(budget_cents)
    end

    it "destroys campaign deploys" do
      expect { described_class.new(deploy).call }.to change { CampaignDeploy.count }.by(-1)
    end

    it "attempts to delete the Langgraph thread" do
      langgraph_client = LanggraphClient.new
      expect(langgraph_client).to receive(:delete).with("/api/deploy/thread/#{deploy.thread_id}")

      described_class.new(deploy).call
    end

    it "does not raise if Google API cleanup fails" do
      allow_any_instance_of(Campaign).to receive(:google_delete).and_raise(StandardError, "API error")

      expect { described_class.new(deploy).call }.not_to raise_error
    end

    it "does not raise if Langgraph thread deletion fails" do
      langgraph_client = instance_double(LanggraphClient)
      allow(LanggraphClient).to receive(:new).and_return(langgraph_client)
      allow(langgraph_client).to receive(:delete).and_raise(StandardError, "Connection refused")

      expect { described_class.new(deploy).call }.not_to raise_error
    end
  end
end
