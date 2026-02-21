require 'rails_helper'

RSpec.describe GoogleAds::Instrumentation do
  let(:account) { create(:account) }
  let(:campaign) { create(:campaign, account: account) }
  let(:ad_group) { create(:ad_group, campaign: campaign) }

  # Use a temp file logger wrapped with TaggedLogging so we can assert on output
  let(:log_output) { StringIO.new }
  let(:google_ads_logger) { ActiveSupport::TaggedLogging.new(Logger.new(log_output)) }

  describe '.with_context' do
    before do
      allow(described_class).to receive(:google_ads_logger).and_return(google_ads_logger)
    end

    it 'yields the block and returns its result' do
      result = described_class.with_context(campaign: campaign) { 42 }
      expect(result).to eq(42)
    end

    it 'works without any context' do
      result = described_class.with_context { "no context" }
      expect(result).to eq("no context")
    end

    it 'tags the google_ads_logger with campaign context' do
      allow(campaign).to receive(:google_customer_id).and_return("123-456-7890")

      described_class.with_context(campaign: campaign) do
        google_ads_logger.info("test message")
      end

      output = log_output.string
      expect(output).to include("campaign_id=#{campaign.id}")
      expect(output).to include("google_customer_id=123-456-7890")
      expect(output).to include("test message")
    end

    it 'tags with ad_group context' do
      described_class.with_context(ad_group: ad_group) do
        google_ads_logger.info("test message")
      end

      output = log_output.string
      expect(output).to include("ad_group_id=#{ad_group.id}")
    end

    it 'tags with keyword context' do
      keyword = create(:ad_keyword, ad_group: ad_group)

      described_class.with_context(keyword: keyword) do
        google_ads_logger.info("test message")
      end

      output = log_output.string
      expect(output).to include("keyword_id=#{keyword.id}")
    end

    it 'tags with ad context' do
      ad = create(:ad, ad_group: ad_group)

      described_class.with_context(ad: ad) do
        google_ads_logger.info("test message")
      end

      output = log_output.string
      expect(output).to include("ad_id=#{ad.id}")
      expect(output).to include("ad_group_id=#{ad.ad_group_id}")
    end

    it 'tags with budget context' do
      budget = create(:ad_budget, campaign: campaign)

      described_class.with_context(budget: budget) do
        google_ads_logger.info("test message")
      end

      output = log_output.string
      expect(output).to include("budget_id=#{budget.id}")
      expect(output).to include("campaign_id=#{budget.campaign_id}")
    end

    it 'combines multiple context objects' do
      described_class.with_context(campaign: campaign, ad_group: ad_group) do
        google_ads_logger.info("test message")
      end

      output = log_output.string
      expect(output).to include("campaign_id=#{campaign.id}")
      expect(output).to include("ad_group_id=#{ad_group.id}")
    end

    it 'omits nil values from tags' do
      described_class.with_context(campaign: nil, ad_group: ad_group) do
        google_ads_logger.info("test message")
      end

      output = log_output.string
      expect(output).not_to match(/=\s/)  # No "key= " (nil value)
      expect(output).not_to include("=nil")
    end

    it 'includes account_id when campaign has an account' do
      described_class.with_context(campaign: campaign) do
        google_ads_logger.info("test message")
      end

      output = log_output.string
      expect(output).to include("account_id=#{campaign.account_id}")
    end

    it 'includes project_id when campaign has a project' do
      described_class.with_context(campaign: campaign) do
        google_ads_logger.info("test message")
      end

      output = log_output.string
      expect(output).to include("project_id=#{campaign.project_id}")
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

    it 'extracts campaign fields including project_id' do
      allow(campaign).to receive(:google_customer_id).and_return("123-456-7890")

      tags = described_class.build_tags(campaign: campaign)

      expect(tags).to include(
        campaign_id: campaign.id,
        project_id: campaign.project_id,
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

  describe 'Instrumentable re-entry guard' do
    before do
      allow(described_class).to receive(:google_ads_logger).and_return(google_ads_logger)
    end

    let(:resource_class) do
      Class.new do
        include GoogleAds::Resources::Instrumentable

        attr_reader :record

        def initialize(record)
          @record = record
        end

        def instrumentation_context
          { campaign: record }
        end

        def outer_method
          with_instrumentation { inner_method }
        end

        def inner_method
          with_instrumentation do
            GoogleAds::Instrumentation.google_ads_logger.info("nested call")
            "result"
          end
        end

        instrument_methods :outer_method, :inner_method
      end
    end

    it 'does not duplicate tags when instrumented methods call each other' do
      resource = resource_class.new(campaign)

      result = resource.outer_method

      output = log_output.string
      tag_occurrences = output.scan("campaign_id=#{campaign.id}").length
      expect(tag_occurrences).to eq(1), "Expected campaign_id tag once, got #{tag_occurrences} times: #{output}"
      expect(result).to eq("result")
    end

    it 'tags correctly when inner method is called directly' do
      resource = resource_class.new(campaign)

      resource.inner_method

      output = log_output.string
      expect(output).to include("campaign_id=#{campaign.id}")
    end

    it 'resets the guard after an exception' do
      resource_class_with_error = Class.new do
        include GoogleAds::Resources::Instrumentable

        attr_reader :record

        def initialize(record)
          @record = record
        end

        def instrumentation_context
          { campaign: record }
        end

        def exploding_method
          with_instrumentation { raise "boom" }
        end

        def normal_method
          with_instrumentation do
            GoogleAds::Instrumentation.google_ads_logger.info("after error")
          end
        end
      end

      resource = resource_class_with_error.new(campaign)

      expect { resource.exploding_method }.to raise_error("boom")

      # Should still instrument normally after the error
      resource.normal_method
      output = log_output.string
      expect(output).to include("campaign_id=#{campaign.id}")
    end
  end

  describe '.google_ads_logger' do
    # These specs do NOT mock google_ads_logger — they exercise the real config

    it 'returns a logger that responds to tagged from the initializer' do
      logger = described_class.google_ads_logger
      expect(logger).to respond_to(:tagged)
    end

    it 'wraps a plain Logger with TaggedLogging on the fly' do
      original = Rails.application.config.google_ads_logger
      begin
        Rails.application.config.google_ads_logger = Logger.new(StringIO.new)
        logger = described_class.google_ads_logger
        expect(logger).to respond_to(:tagged)
      ensure
        Rails.application.config.google_ads_logger = original
      end
    end

    it 'does not re-wrap a logger that already supports tagged' do
      original = Rails.application.config.google_ads_logger
      begin
        tagged_logger = ActiveSupport::TaggedLogging.new(Logger.new(StringIO.new))
        Rails.application.config.google_ads_logger = tagged_logger
        expect(described_class.google_ads_logger).to equal(tagged_logger)
      ensure
        Rails.application.config.google_ads_logger = original
      end
    end
  end
end
