module GoogleAds
  module Resources
    class StructuredSnippet
      include FieldMappable

      attr_reader :record

      # ═══════════════════════════════════════════════════════════════
      # FIELD MAPPINGS
      # ═══════════════════════════════════════════════════════════════

      field_mapping :header,
        local: ->(r) { StructuredSnippetCategoriesConfig.definitions.dig(r.category, :key) || r.category.titleize },
        remote: :header

      field_mapping :values,
        local: :values,
        remote: :values

      def initialize(record)
        @record = record
      end

      # ═══════════════════════════════════════════════════════════════
      # CLASS METHODS: Collection Operations (Campaign has_one structured_snippet)
      # ═══════════════════════════════════════════════════════════════

      class << self
        def synced?(campaign)
          # Check if any soft-deleted snippets need Google cleanup
          ::AdStructuredSnippet.only_deleted.where(campaign_id: campaign.id).each do |snippet|
            return false if snippet.google_asset_id.present?
          end

          # Check if active structured snippet is synced
          snippet = ::AdStructuredSnippet.where(campaign_id: campaign.id).first
          return true unless snippet

          new(snippet).synced?
        end

        def sync_all(campaign)
          results = []

          # Delete soft-deleted snippets with Google IDs
          ::AdStructuredSnippet.only_deleted.where(campaign_id: campaign.id).each do |snippet|
            next unless snippet.google_asset_id.present?
            results << new(snippet).delete
          end

          # Sync active structured snippet
          snippet = ::AdStructuredSnippet.where(campaign_id: campaign.id).first
          results << new(snippet).sync if snippet

          Sync::CollectionSyncResult.new(results: results)
        end

        def sync_plan(campaign)
          operations = []

          # Plan deletions
          ::AdStructuredSnippet.only_deleted.where(campaign_id: campaign.id).each do |snippet|
            next unless snippet.google_asset_id.present?
            operations << {
              action: :delete,
              record: snippet,
              asset_id: snippet.google_asset_id
            }
          end

          # Plan syncs
          snippet = ::AdStructuredSnippet.where(campaign_id: campaign.id).first
          operations.concat(new(snippet).sync_plan.operations) if snippet

          Sync::Plan.new(operations)
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

        remote = fetch
        if remote
          # Asset exists but fields don't match - assets are immutable
          # We need to delete the link and create a new asset
          delete_and_recreate
        else
          create_asset_and_link
        end
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:asset, e)
      end

      def sync_plan
        operations = []

        remote = fetch
        if remote.nil?
          operations << {
            action: :create,
            record: record,
            header: header_for_category,
            values: record.values
          }
        elsif !fields_match?(remote)
          comparison = compare_fields(remote)
          operations << {
            action: :recreate,
            record: record,
            fields: comparison.failures,
            reason: "assets are immutable"
          }
        end

        Sync::Plan.new(operations)
      end

      def delete
        return GoogleAds::SyncResult.not_found(:campaign_asset) unless record.google_asset_id.present?

        unlink_from_campaign
        clear_asset_id
        GoogleAds::SyncResult.deleted(:campaign_asset)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        if resource_not_found_error?(e)
          clear_asset_id
          GoogleAds::SyncResult.deleted(:campaign_asset)
        else
          GoogleAds::SyncResult.error(:campaign_asset, e)
        end
      end

      def fetch
        fetch_by_id || fetch_by_content
      end

      # compare_fields provided by FieldMappable

      private

      # ═══════════════════════════════════════════════════════════════
      # API OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      def create_asset_and_link
        # Step 1: Create the asset
        asset_operation = client.operation.create_resource.asset do |asset|
          asset.structured_snippet_asset = client.resource.structured_snippet_asset do |snippet|
            snippet.header = header_for_category
            record.values.each { |v| snippet.values << v }
          end
        end

        asset_response = client.service.asset.mutate_assets(
          customer_id: customer_id,
          operations: [asset_operation]
        )

        asset_resource_name = asset_response.results.first.resource_name
        asset_id = asset_resource_name.split("/").last.to_i
        save_asset_id(asset_id)

        # Step 2: Link to campaign
        link_operation = client.operation.create_resource.campaign_asset do |ca|
          ca.campaign = campaign_resource_name
          ca.asset = asset_resource_name
          ca.field_type = :STRUCTURED_SNIPPET
        end

        client.service.campaign_asset.mutate_campaign_assets(
          customer_id: customer_id,
          operations: [link_operation]
        )

        GoogleAds::SyncResult.created(:asset, asset_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:asset, e)
      end

      def delete_and_recreate
        # Unlink current asset from campaign
        unlink_from_campaign
        clear_asset_id

        # Create new asset and link
        create_asset_and_link
      end

      def unlink_from_campaign
        campaign_asset_resource_name = "customers/#{customer_id}/campaignAssets/#{google_campaign_id}~#{record.google_asset_id}~STRUCTURED_SNIPPET"
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

        asset = results.first&.asset
        return nil unless asset

        RemoteStructuredSnippet.new(
          resource_name: asset.resource_name,
          id: asset.id,
          header: asset.structured_snippet_asset.header,
          values: asset.structured_snippet_asset.values.to_a
        )
      end

      def fetch_by_content
        return nil unless record.category.present?

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_by_content_query
        )

        asset = results.find { |row| row.asset.structured_snippet_asset.values == record.values }&.asset
        return nil unless asset

        # Backfill the asset_id since we found it by content
        save_asset_id(asset.id.to_s)

        RemoteStructuredSnippet.new(
          resource_name: asset.resource_name,
          id: asset.id,
          header: asset.structured_snippet_asset.header,
          values: asset.structured_snippet_asset.values.to_a
        )
      end

      # ═══════════════════════════════════════════════════════════════
      # FIELD TRANSFORMS
      # ═══════════════════════════════════════════════════════════════

      # fields_match? provided by FieldMappable

      def header_for_category
        StructuredSnippetCategoriesConfig.definitions.dig(record.category, :key) || record.category.titleize
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
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "asset_id" => asset_id.to_s }))
      end

      def clear_asset_id
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "asset_id" => nil }))
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

      def google_campaign_id
        campaign.google_campaign_id.to_s
      end

      def campaign_resource_name
        "customers/#{customer_id}/campaigns/#{google_campaign_id}"
      end

      def fetch_by_id_query
        <<~GAQL.squish
          SELECT asset.id, asset.resource_name, asset.structured_snippet_asset.header, asset.structured_snippet_asset.values
          FROM asset
          WHERE asset.id = #{record.google_asset_id}
        GAQL
      end

      def fetch_by_content_query
        <<~GAQL.squish
          SELECT asset.id, asset.resource_name, asset.structured_snippet_asset.header, asset.structured_snippet_asset.values
          FROM asset
          WHERE asset.type = 'STRUCTURED_SNIPPET'
            AND asset.structured_snippet_asset.header = '#{header_for_category}'
        GAQL
      end

      # ═══════════════════════════════════════════════════════════════
      # VALUE OBJECT for Remote Structured Snippet
      # ═══════════════════════════════════════════════════════════════

      class RemoteStructuredSnippet
        attr_reader :resource_name, :id, :header, :values

        def initialize(resource_name:, id:, header:, values:)
          @resource_name = resource_name
          @id = id
          @header = header
          @values = values
        end

        def structured_snippet_asset
          self
        end
      end
    end
  end
end
