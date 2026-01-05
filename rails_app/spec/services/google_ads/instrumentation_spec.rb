require 'rails_helper'

RSpec.describe GoogleAds::Instrumentation do
  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account) }
  let(:ad_group) { create(:ad_group, campaign: campaign) }

  describe '.with_context' do
    it 'yields the block and returns its result' do
      result = described_class.with_context(campaign: campaign) { 42 }
      expect(result).to eq(42)
    end

    it 'works without any context' do
      result = described_class.with_context { "no context" }
      expect(result).to eq("no context")
    end

    it 'tags Rails.logger with campaign context' do
      allow(campaign).to receive(:google_customer_id).and_return("123-456-7890")

      expect(Rails.logger).to receive(:tagged).with(
        hash_including(
          campaign_id: campaign.id,
          google_customer_id: "123-456-7890"
        )
      ).and_yield

      described_class.with_context(campaign: campaign) { "test" }
    end

    it 'tags Rails.logger with ad_group context' do
      expect(Rails.logger).to receive(:tagged).with(
        hash_including(
          ad_group_id: ad_group.id
        )
      ).and_yield

      described_class.with_context(ad_group: ad_group) { "test" }
    end

    it 'tags Rails.logger with keyword context' do
      keyword = create(:ad_keyword, ad_group: ad_group)

      expect(Rails.logger).to receive(:tagged).with(
        hash_including(
          keyword_id: keyword.id
        )
      ).and_yield

      described_class.with_context(keyword: keyword) { "test" }
    end

    it 'tags Rails.logger with ad context' do
      ad = create(:ad, ad_group: ad_group)

      expect(Rails.logger).to receive(:tagged).with(
        hash_including(
          ad_id: ad.id,
          ad_group_id: ad.ad_group_id
        )
      ).and_yield

      described_class.with_context(ad: ad) { "test" }
    end

    it 'tags Rails.logger with budget context' do
      budget = create(:ad_budget, campaign: campaign)

      expect(Rails.logger).to receive(:tagged).with(
        hash_including(
          budget_id: budget.id,
          campaign_id: budget.campaign_id
        )
      ).and_yield

      described_class.with_context(budget: budget) { "test" }
    end

    it 'combines multiple context objects' do
      expect(Rails.logger).to receive(:tagged).with(
        hash_including(
          campaign_id: campaign.id,
          ad_group_id: ad_group.id
        )
      ).and_yield

      described_class.with_context(campaign: campaign, ad_group: ad_group) { "test" }
    end

    it 'omits nil values from tags' do
      expect(Rails.logger).to receive(:tagged) do |tags|
        expect(tags.values).not_to include(nil)
      end.and_yield

      described_class.with_context(campaign: nil, ad_group: ad_group) { "test" }
    end

    it 'includes account_id when campaign has an account' do
      expect(Rails.logger).to receive(:tagged).with(
        hash_including(
          account_id: campaign.account_id
        )
      ).and_yield

      described_class.with_context(campaign: campaign) { "test" }
    end

    it 'propagates exceptions from the block' do
      expect {
        described_class.with_context(campaign: campaign) { raise "test error" }
      }.to raise_error("test error")
    end
  end

  describe '.build_tags' do
    it 'returns empty hash when no context provided' do
      tags = described_class.build_tags
      expect(tags).to eq({})
    end

    it 'extracts campaign fields' do
      allow(campaign).to receive(:google_customer_id).and_return("123-456-7890")

      tags = described_class.build_tags(campaign: campaign)

      expect(tags).to include(
        campaign_id: campaign.id,
        google_customer_id: "123-456-7890",
        account_id: campaign.account_id
      )
    end

    it 'extracts ad_group fields including parent campaign' do
      tags = described_class.build_tags(ad_group: ad_group)

      expect(tags).to include(
        ad_group_id: ad_group.id,
        campaign_id: ad_group.campaign_id
      )
    end

    it 'extracts ad fields including parent ad_group' do
      ad = create(:ad, ad_group: ad_group)
      tags = described_class.build_tags(ad: ad)

      expect(tags).to include(
        ad_id: ad.id,
        ad_group_id: ad.ad_group_id
      )
    end

    it 'extracts budget fields including parent campaign' do
      budget = create(:ad_budget, campaign: campaign)
      tags = described_class.build_tags(budget: budget)

      expect(tags).to include(
        budget_id: budget.id,
        campaign_id: budget.campaign_id
      )
    end

    it 'allows explicit values to override extracted ones' do
      allow(campaign).to receive(:google_customer_id).and_return("original-456")

      tags = described_class.build_tags(
        campaign: campaign,
        google_customer_id: "override-123"
      )

      expect(tags[:google_customer_id]).to eq("override-123")
    end
  end
end
