module GoogleAds
  module Instrumentation
    class << self
      # Wraps a block with tagged logging context for Google Ads operations.
      #
      # @param campaign [Campaign, nil] Campaign to extract context from
      # @param ad_group [AdGroup, nil] AdGroup to extract context from
      # @param keyword [AdKeyword, nil] Keyword to extract context from
      # @param google_customer_id [String, nil] Explicit customer ID override
      # @yield The block to execute within the tagged context
      # @return The result of the block
      #
      # @example Basic usage with campaign
      #   GoogleAds::Instrumentation.with_context(campaign: @campaign) do
      #     client.service.campaign.mutate_campaigns(...)
      #   end
      #
      # @example Multiple context objects
      #   GoogleAds::Instrumentation.with_context(campaign: @campaign, ad_group: @ad_group) do
      #     client.service.ad_group.mutate_ad_groups(...)
      #   end
      #
      def with_context(campaign: nil, ad_group: nil, ad: nil, keyword: nil, budget: nil, **overrides, &block)
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
          # Format as "key=value" strings for log aggregator compatibility (Datadog, etc.)
          formatted_tags = tags.map { |k, v| "#{k}=#{v}" }
          Rails.logger.tagged(*formatted_tags, &block)
        end
      end

      # Builds a hash of tags from the provided context objects.
      # Extracts IDs from domain objects to create searchable log tags.
      #
      # Uses our internal naming conventions for our IDs (campaign_id, ad_group_id, etc.)
      # but preserves Google's naming for their IDs (google_customer_id).
      #
      # @param campaign [Campaign, nil]
      # @param ad_group [AdGroup, nil]
      # @param ad [Ad, nil]
      # @param keyword [AdKeyword, nil]
      # @param budget [AdBudget, nil]
      # @param overrides [Hash] Explicit values that override extracted ones
      # @return [Hash] Tags suitable for Rails.logger.tagged
      #
      def build_tags(campaign: nil, ad_group: nil, ad: nil, keyword: nil, budget: nil, **overrides)
        tags = {}

        # Extract from campaign
        if campaign
          tags[:campaign_id] = campaign.id
          tags[:google_customer_id] = campaign.google_customer_id
          tags[:account_id] = campaign.account_id
        end

        # Extract from ad_group (includes parent campaign reference)
        if ad_group
          tags[:ad_group_id] = ad_group.id
          tags[:campaign_id] ||= ad_group.campaign_id
        end

        # Extract from ad (includes parent ad_group reference)
        if ad
          tags[:ad_id] = ad.id
          tags[:ad_group_id] ||= ad.ad_group_id
        end

        # Extract from keyword
        if keyword
          tags[:keyword_id] = keyword.id
          tags[:ad_group_id] ||= keyword.ad_group_id
        end

        # Extract from budget
        if budget
          tags[:budget_id] = budget.id
          tags[:campaign_id] ||= budget.campaign_id
        end

        # Apply explicit overrides
        overrides.each do |key, value|
          tags[key] = value
        end

        # Remove nil values
        tags.compact
      end
    end
  end
end
