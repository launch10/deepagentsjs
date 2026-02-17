module GoogleAds
  module Instrumentation
    class << self
      def google_ads_logger
        logger = Rails.application.config.google_ads_logger
        return logger if logger.respond_to?(:tagged)

        # Ensure TaggedLogging even if the initializer hasn't re-run (e.g. hot reload)
        Rails.application.config.google_ads_logger = ActiveSupport::TaggedLogging.new(logger)
      end

      # Wraps a block with tagged logging context for Google Ads operations.
      # Tags are applied to the dedicated google_ads_logger so that all API
      # request/response entries include our domain context (campaign_id, project_id, etc.).
      #
      # @param campaign [Campaign, nil] Campaign to extract context from
      # @param ad_group [AdGroup, nil] AdGroup to extract context from
      # @param keyword [AdKeyword, nil] Keyword to extract context from
      # @param google_customer_id [String, nil] Explicit customer ID override
      # @yield The block to execute within the tagged context
      # @return The result of the block
      #
      def with_context(campaign: nil, ad_group: nil, ad: nil, keyword: nil, budget: nil, **overrides, &)
        tags = build_tags(
          campaign: campaign,
          ad_group: ad_group,
          ad: ad,
          keyword: keyword,
          budget: budget,
          **overrides
        )

        if tags.empty?
          yield
        else
          formatted_tags = tags.map { |k, v| "#{k}=#{v}" }
          google_ads_logger.tagged(*formatted_tags, &)
        end
      end

      # Builds a hash of tags from the provided context objects.
      # Extracts IDs from domain objects to create searchable log tags.
      #
      # @param campaign [Campaign, nil]
      # @param ad_group [AdGroup, nil]
      # @param ad [Ad, nil]
      # @param keyword [AdKeyword, nil]
      # @param budget [AdBudget, nil]
      # @param overrides [Hash] Explicit values that override extracted ones
      # @return [Hash] Tags suitable for tagged logging
      #
      def build_tags(campaign: nil, ad_group: nil, ad: nil, keyword: nil, budget: nil, **overrides)
        tags = {}

        if campaign
          tags[:campaign_id] = campaign.id
          tags[:project_id] = campaign.project_id
          tags[:google_customer_id] = campaign.google_customer_id
          tags[:account_id] = campaign.account_id
        end

        if ad_group
          tags[:ad_group_id] = ad_group.id
          tags[:campaign_id] ||= ad_group.campaign_id
        end

        if ad
          tags[:ad_id] = ad.id
          tags[:ad_group_id] ||= ad.ad_group_id
        end

        if keyword
          tags[:keyword_id] = keyword.id
          tags[:ad_group_id] ||= keyword.ad_group_id
        end

        if budget
          tags[:budget_id] = budget.id
          tags[:campaign_id] ||= budget.campaign_id
        end

        overrides.each do |key, value|
          tags[key] = value
        end

        tags.compact
      end
    end
  end
end
