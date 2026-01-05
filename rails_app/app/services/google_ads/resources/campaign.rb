module GoogleAds
  module Resources
    class Campaign
      attr_reader :record

      def initialize(record)
        @record = record
      end

      # ═══════════════════════════════════════════════════════════════
      # CLASS METHODS: Collection Operations (AdsAccount has many campaigns)
      # ═══════════════════════════════════════════════════════════════

      class << self
        def synced?(ads_account)
          # Soft-deleted campaigns with campaign_id means NOT synced (needs delete from Google)
          ads_account.campaigns.only_deleted.each do |campaign|
            return false if campaign.google_campaign_id.present?
          end

          # All active campaigns must be synced
          ads_account.campaigns.without_deleted.each do |campaign|
            return false unless new(campaign).synced?
          end

          true
        end

        def sync_all(ads_account)
          results = []

          # Delete soft-deleted campaigns with Google IDs
          ads_account.campaigns.only_deleted.each do |campaign|
            next unless campaign.google_campaign_id.present?
            results << new(campaign).delete
          end

          # Sync active campaigns
          ads_account.campaigns.without_deleted.each do |campaign|
            results << new(campaign).sync
          end

          Sync::CollectionSyncResult.new(results: results)
        end

        def sync_plan(ads_account)
          operations = []

          # Plan deletions for soft-deleted campaigns
          ads_account.campaigns.only_deleted.each do |campaign|
            next unless campaign.google_campaign_id.present?
            operations << {
              action: :delete,
              record: campaign,
              campaign_id: campaign.google_campaign_id
            }
          end

          # Plan syncs for active campaigns
          ads_account.campaigns.without_deleted.each do |campaign|
            operations.concat(new(campaign).sync_plan.operations)
          end

          Sync::Plan.new(operations)
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # INSTANCE METHODS (5 methods)
      # ═══════════════════════════════════════════════════════════════

      def synced?
        remote = fetch
        return false unless remote
        return false if remote.status == :REMOVED

        fields_match?(remote)
      end

      def sync
        return GoogleAds::SyncResult.unchanged(:campaign, record.google_campaign_id) if synced?

        remote = fetch
        if remote && remote.status != :REMOVED
          update_campaign(remote)
        else
          create_campaign
        end
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign, e)
      end

      def sync_plan
        operations = []

        remote = fetch
        if remote.nil?
          operations << { action: :create, record: record, budget_id: record.budget&.google_budget_id }
        elsif remote.status == :REMOVED
          # REMOVED campaigns need to be recreated
          operations << { action: :create, record: record, budget_id: record.budget&.google_budget_id }
        elsif !fields_match?(remote)
          comparison = compare_fields(remote)
          # Only mutable fields can be updated (name, status - NOT advertising_channel_type)
          mutable_mismatches = comparison.failures - [:advertising_channel_type, :contains_eu_political_advertising]
          operations << { action: :update, record: record, fields: mutable_mismatches } if mutable_mismatches.any?
        end

        Sync::Plan.new(operations)
      end

      def delete
        return GoogleAds::SyncResult.not_found(:campaign) unless record.google_campaign_id.present?

        remove_from_google
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "campaign_id" => nil }))
        GoogleAds::SyncResult.deleted(:campaign)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        if resource_not_found_error?(e)
          record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "campaign_id" => nil }))
          GoogleAds::SyncResult.deleted(:campaign)
        else
          GoogleAds::SyncResult.error(:campaign, e)
        end
      end

      def fetch
        fetch_by_id || fetch_by_name
      end

      def compare_fields(remote)
        FieldCompare.build do |c|
          c.check(:name, local: record.name, remote: remote.name) do
            record.name == remote.name
          end

          c.check(:status, local: record.google_status, remote: remote.status) do
            record.google_status.to_s.upcase.to_sym == remote.status
          end

          c.check(:advertising_channel_type, local: record.google_advertising_channel_type, remote: remote.advertising_channel_type) do
            record.google_advertising_channel_type.to_s.upcase.to_sym == remote.advertising_channel_type
          end
        end
      end

      private

      # ═══════════════════════════════════════════════════════════════
      # API OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      def create_campaign
        operation = client.operation.create_resource.campaign do |c|
          c.name = record.name
          c.advertising_channel_type = record.google_advertising_channel_type.to_s.upcase.to_sym
          c.status = record.google_status.to_s.upcase.to_sym
          c.campaign_budget = budget_resource_name if budget_resource_name
          c.start_date = record.start_date.strftime("%Y%m%d") if record.start_date
          c.end_date = record.end_date.strftime("%Y%m%d") if record.end_date
          c.network_settings = record.google_network_settings_for_api(client)
          c.contains_eu_political_advertising = record.google_contains_eu_political_advertising
          set_bidding_strategy(c)
        end

        response = client.service.campaign.mutate_campaigns(
          customer_id: customer_id,
          operations: [operation]
        )

        resource_name = response.results.first.resource_name
        campaign_id = resource_name.split("/").last.to_i
        save_campaign_id(campaign_id)

        GoogleAds::SyncResult.created(:campaign, campaign_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign, e)
      end

      def update_campaign(remote)
        comparison = compare_fields(remote)
        mutable_mismatches = comparison.failures - [:advertising_channel_type, :contains_eu_political_advertising]
        return GoogleAds::SyncResult.unchanged(:campaign, record.google_campaign_id) if mutable_mismatches.empty?

        resource_name = remote.resource_name

        operation = client.operation.update_resource.campaign(resource_name) do |c|
          if mutable_mismatches.include?(:name)
            c.name = record.name
          end
          if mutable_mismatches.include?(:status)
            c.status = record.google_status.to_s.upcase.to_sym
          end
        end

        client.service.campaign.mutate_campaigns(
          customer_id: customer_id,
          operations: [operation]
        )

        GoogleAds::SyncResult.updated(:campaign, record.google_campaign_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign, e)
      end

      def remove_from_google
        resource_name = "customers/#{customer_id}/campaigns/#{record.google_campaign_id}"
        operation = client.operation.remove_resource.campaign(resource_name)
        client.service.campaign.mutate_campaigns(
          customer_id: customer_id,
          operations: [operation]
        )
      end

      # ═══════════════════════════════════════════════════════════════
      # FETCH HELPERS
      # ═══════════════════════════════════════════════════════════════

      def fetch_by_id
        return nil unless record.google_campaign_id.present?

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_by_id_query
        )
        results.first&.campaign
      end

      def fetch_by_name
        return nil unless record.name.present?

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_by_name_query
        )
        campaign = results.first&.campaign
        return nil unless campaign

        # Backfill the ID if found by name
        backfill_campaign_id(campaign.id)
        campaign
      end

      # ═══════════════════════════════════════════════════════════════
      # FIELD TRANSFORMS
      # ═══════════════════════════════════════════════════════════════

      def fields_match?(remote)
        compare_fields(remote).match?
      end

      def escape_name(name)
        name.gsub("'", "\\\\'")
      end

      # ═══════════════════════════════════════════════════════════════
      # ERROR HANDLING
      # ═══════════════════════════════════════════════════════════════

      def resource_not_found_error?(error)
        error.failure.errors.any? do |err|
          err.error_code.to_h[:mutate_error] == :RESOURCE_NOT_FOUND
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # HELPERS
      # ═══════════════════════════════════════════════════════════════

      def save_campaign_id(campaign_id)
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "campaign_id" => campaign_id }))
      end

      def backfill_campaign_id(id)
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "campaign_id" => id.to_s }))
      end

      def budget_resource_name
        budget = record.budget
        return nil unless budget&.google_budget_id

        "customers/#{customer_id}/campaignBudgets/#{budget.google_budget_id}"
      end

      def set_bidding_strategy(campaign_operation)
        # TargetSpend is closest to MaximizeClicks behavior - the only thing we support for now
        campaign_operation.target_spend = Google::Ads::GoogleAds::V22::Common::TargetSpend.new
      end

      def client
        GoogleAds.client
      end

      def customer_id
        record.google_customer_id.to_s
      end

      def fetch_by_id_query
        <<~GAQL.squish
          SELECT campaign.resource_name, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type, campaign.contains_eu_political_advertising
          FROM campaign
          WHERE campaign.id = #{record.google_campaign_id}
        GAQL
      end

      def fetch_by_name_query
        <<~GAQL.squish
          SELECT campaign.resource_name, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type, campaign.contains_eu_political_advertising
          FROM campaign
          WHERE campaign.name = '#{escape_name(record.name)}'
        GAQL
      end
    end
  end
end
