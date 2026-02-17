module GoogleAds
  module Resources
    class Callout
      include FieldMappable
      include Instrumentable

      attr_reader :record

      # ═══════════════════════════════════════════════════════════════
      # FIELD MAPPINGS
      # ═══════════════════════════════════════════════════════════════

      field_mapping :text,
        local: :text,
        remote: ->(asset) { asset.callout_asset.callout_text }

      def initialize(record)
        @record = record
      end

      def instrumentation_context
        { campaign: record.campaign }
      end

      instrument_methods :sync, :synced?, :sync_result, :sync_plan, :delete, :fetch

      # ═══════════════════════════════════════════════════════════════
      # CLASS METHODS: Collection Operations
      # ═══════════════════════════════════════════════════════════════

      class << self
        def synced?(campaign)
          # Soft-deleted callouts with asset_id means NOT synced (needs unlink from Google)
          campaign.callouts.only_deleted.each do |callout|
            return false if callout.google_asset_id.present?
          end

          # All active callouts must be synced
          campaign.callouts.without_deleted.each do |callout|
            return false unless new(callout).synced?
          end

          true
        end

        def sync_all(campaign)
          results = []

          # Delete soft-deleted callouts with Google IDs
          campaign.callouts.only_deleted.each do |callout|
            next unless callout.google_asset_id.present?
            results << new(callout).delete
          end

          # Sync active callouts
          campaign.callouts.without_deleted.each do |callout|
            results << new(callout).sync
          end

          ::GoogleAds::Sync::CollectionSyncResult.new(results: results)
        end

        def sync_plan(campaign)
          operations = []

          # Plan deletions for soft-deleted callouts
          campaign.callouts.only_deleted.each do |callout|
            next unless callout.google_asset_id.present?
            operations << {
              action: :delete,
              record: callout,
              asset_id: callout.google_asset_id
            }
          end

          # Plan syncs for active callouts
          campaign.callouts.without_deleted.each do |callout|
            operations.concat(new(callout).sync_plan.operations)
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

        fields_match?(remote)
      end

      def sync
        return GoogleAds::SyncResult.unchanged(:asset, record.google_asset_id) if synced?

        if record.google_asset_id && fetch
          # Asset exists - return unchanged (assets are immutable)
          GoogleAds::SyncResult.unchanged(:asset, record.google_asset_id)
        else
          create_callout_asset
        end
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:asset, e)
      end

      def sync_plan
        operations = []

        remote = fetch
        if remote.nil?
          operations << { action: :create_asset, record: record, text: attrs[:text] }
          operations << { action: :link_to_campaign, record: record, campaign_id: campaign.google_campaign_id }
        else
          operations << { action: :unchanged, record: record }
        end

        GoogleAds::Sync::Plan.new(operations)
      end

      def delete
        return GoogleAds::SyncResult.not_found(:campaign_asset) unless record.google_asset_id.present?

        unlink_from_campaign
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "asset_id" => nil }))
        GoogleAds::SyncResult.deleted(:campaign_asset)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        if resource_not_found_error?(e)
          record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "asset_id" => nil }))
          GoogleAds::SyncResult.deleted(:campaign_asset)
        else
          GoogleAds::SyncResult.error(:campaign_asset, e)
        end
      end

      def fetch
        fetch_by_id || fetch_by_content
      end

      private

      # ═══════════════════════════════════════════════════════════════
      # API OPERATIONS (two-step creation)
      # ═══════════════════════════════════════════════════════════════

      def create_callout_asset
        # Step 1: Create the asset
        asset_operation = client.operation.create_resource.asset do |asset|
          asset.callout_asset = client.resource.callout_asset do |ca|
            ca.callout_text = attrs[:text]
          end
        end

        asset_response = client.service.asset.mutate_assets(
          customer_id: customer_id,
          operations: [asset_operation]
        )

        asset_resource_name = asset_response.results.first.resource_name
        asset_id = asset_resource_name.split("/").last.to_i
        save_asset_id(asset_id)

        # Step 2: Link asset to campaign
        link_operation = client.operation.create_resource.campaign_asset do |ca|
          ca.campaign = campaign_resource_name
          ca.asset = asset_resource_name
          ca.field_type = :CALLOUT
        end

        client.service.campaign_asset.mutate_campaign_assets(
          customer_id: customer_id,
          operations: [link_operation]
        )

        GoogleAds::SyncResult.created(:asset, asset_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:asset, e)
      end

      def unlink_from_campaign
        operation = client.operation.remove_resource.campaign_asset(campaign_asset_resource_name)
        client.service.campaign_asset.mutate_campaign_assets(
          customer_id: customer_id,
          operations: [operation]
        )
      end

      # ═══════════════════════════════════════════════════════════════
      # FETCH HELPERS
      # ═══════════════════════════════════════════════════════════════

      def fetch_by_id
        return nil unless record.google_asset_id.present?

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_by_id_query
        )
        results.first&.asset
      end

      def fetch_by_content
        return nil unless record.text.present?

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_by_content_query
        )
        asset = results.first&.asset
        return nil unless asset

        # Backfill the ID if found by content
        backfill_asset_id(asset.id)
        asset
      end

      # ═══════════════════════════════════════════════════════════════
      # FIELD TRANSFORMS
      # ═══════════════════════════════════════════════════════════════

      # All field values with transforms applied (via to_google_json)
      def attrs
        @attrs ||= to_google_json
      end

      def escape_text(text)
        text.gsub("'", "\\\\'")
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

      def save_asset_id(asset_id)
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "asset_id" => asset_id }))
      end

      def backfill_asset_id(id)
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "asset_id" => id.to_s }))
      end

      def client
        GoogleAds.client
      end

      def customer_id
        campaign.google_customer_id.to_s
      end

      def campaign
        record.campaign
      end

      def campaign_resource_name
        "customers/#{customer_id}/campaigns/#{campaign.google_campaign_id}"
      end

      def campaign_asset_resource_name
        "customers/#{customer_id}/campaignAssets/#{campaign.google_campaign_id}~#{record.google_asset_id}~CALLOUT"
      end

      def fetch_by_id_query
        <<~GAQL.squish
          SELECT asset.id, asset.resource_name, asset.callout_asset.callout_text
          FROM asset
          WHERE asset.id = #{record.google_asset_id}
        GAQL
      end

      def fetch_by_content_query
        <<~GAQL.squish
          SELECT asset.id, asset.resource_name, asset.callout_asset.callout_text
          FROM asset
          WHERE asset.type = 'CALLOUT'
            AND asset.callout_asset.callout_text = '#{escape_text(record.text)}'
        GAQL
      end
    end
  end
end
