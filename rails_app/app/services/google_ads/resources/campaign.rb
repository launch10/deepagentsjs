module GoogleAds
  module Resources
    class Campaign
      include FieldMappable
      include Instrumentable

      attr_reader :record

      # ═══════════════════════════════════════════════════════════════
      # FIELD MAPPINGS
      # ═══════════════════════════════════════════════════════════════

      field_mapping :name,
        local: :name,
        remote: :name

      field_mapping :status,
        local: :google_status,
        remote: :status,
        transform: Transforms::UPCASE_SYMBOL,
        reverse_transform: Transforms::DOWNCASE_STRING

      field_mapping :advertising_channel_type,
        local: :google_advertising_channel_type,
        remote: :advertising_channel_type,
        transform: Transforms::UPCASE_SYMBOL,
        reverse_transform: Transforms::DOWNCASE_STRING,
        immutable: true

      field_mapping :contains_eu_political_advertising,
        local: :google_contains_eu_political_advertising,
        remote: :contains_eu_political_advertising,
        transform: ->(value) { value ? :CONTAINS_EU_POLITICAL_ADVERTISING : :DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING },
        reverse_transform: ->(value) {
          return false if value === :UNSPECIFIED
          value === :CONTAINS_EU_POLITICAL_ADVERTISING
        }

      def initialize(record)
        @record = record
      end

      def instrumentation_context
        { campaign: record }
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

          ::GoogleAds::Sync::CollectionSyncResult.new(results: results)
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

          ::GoogleAds::Sync::Plan.new(operations)
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

      # Returns a SyncResult representing the current sync state without performing any sync.
      # Used by CampaignDeploy steps to check if the sync is complete.
      def sync_result
        remote = fetch
        return GoogleAds::SyncResult.not_found(:campaign) unless remote
        return GoogleAds::SyncResult.not_found(:campaign) if remote.status == :REMOVED

        if fields_match?(remote)
          GoogleAds::SyncResult.unchanged(:campaign, record.google_campaign_id)
        else
          comparison = compare_fields(remote)
          GoogleAds::SyncResult.error(
            :campaign,
            GoogleAds::SyncVerificationError.new(
              "Campaign sync verification failed. Mismatched fields: #{comparison.failures.join(", ")}"
            )
          )
        end
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
          operations << if mutable_mismatches.any?
            { action: :update, record: record, fields: mutable_mismatches }
          else
            { action: :unchanged, record: record }
          end
        else
          operations << { action: :unchanged, record: record }
        end

        GoogleAds::Sync::Plan.new(operations)
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

      # compare_fields provided by FieldMappable

      # ═══════════════════════════════════════════════════════════════
      # INSTRUMENTATION
      # Wrap public methods with logging context
      # ═══════════════════════════════════════════════════════════════

      instrument_methods :sync, :sync_result, :sync_plan, :delete, :fetch

      private

      # ═══════════════════════════════════════════════════════════════
      # API OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      def create_campaign
        operation = client.operation.create_resource.campaign do |c|
          # Mapped fields (transforms applied via to_google_json)
          c.name = attrs[:name]
          c.status = attrs[:status]
          c.advertising_channel_type = attrs[:advertising_channel_type]
          c.contains_eu_political_advertising = attrs[:contains_eu_political_advertising]

          # Non-mapped fields
          c.campaign_budget = budget_resource_name if budget_resource_name
          c.start_date = record.start_date.strftime("%Y%m%d") if record.start_date
          c.end_date = record.end_date.strftime("%Y%m%d") if record.end_date
          c.network_settings = record.google_network_settings_for_api(client)
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
          # Only update changed mutable fields, using pre-transformed attrs
          c.name = attrs[:name] if mutable_mismatches.include?(:name)
          c.status = attrs[:status] if mutable_mismatches.include?(:status)
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

      # All field values with transforms applied (via to_google_json)
      def attrs
        @attrs ||= to_google_json
      end

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
