module GoogleAds
  module Resources
    class Favicon
      include FieldMappable
      include Instrumentable

      attr_reader :record, :campaign

      # No field_mappings - images are binary and can't be field-compared

      def initialize(record, campaign:)
        @record = record
        @campaign = campaign || infer_campaign
      end

      def instrumentation_context
        { campaign: campaign }
      end

      instrument_methods :sync, :synced?, :sync_result, :sync_plan, :delete, :fetch

      # ═══════════════════════════════════════════════════════════════
      # INSTANCE METHODS (5 methods)
      # Favicon sync is manual - no class-level collection operations
      # ═══════════════════════════════════════════════════════════════

      def synced?
        return false unless record.google_asset_id
        fetch.present?
      end

      def sync
        return GoogleAds::SyncResult.unchanged(:asset, record.google_asset_id) if synced?

        create_image_asset
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:asset, e)
      end

      def sync_plan
        operations = []

        if !record.google_asset_id || fetch.nil?
          operations << { action: :create_asset, record: record, campaign_id: campaign.google_campaign_id }
          operations << { action: :link_to_campaign, record: record, field_type: :BUSINESS_LOGO }
        end

        GoogleAds::Sync::Plan.new(operations)
      end

      def delete
        return GoogleAds::SyncResult.not_found(:campaign_asset) unless record.google_asset_id.present?

        unlink_from_campaign
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "asset_id" => nil }))
        GoogleAds::SyncResult.deleted(:campaign_asset)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign_asset, e)
      end

      def fetch
        fetch_by_id
      end

      # compare_fields inherited from FieldMappable - returns empty FieldCompare
      # since no field_mappings are defined (images are binary)

      private

      # ═══════════════════════════════════════════════════════════════
      # API OPERATIONS (two-step: asset creation + campaign linking)
      # ═══════════════════════════════════════════════════════════════

      def create_image_asset
        image_data = fetch_image_data
        return GoogleAds::SyncResult.error(:asset, StandardError.new("Could not fetch image data")) unless image_data

        asset_operation = client.operation.create_resource.asset do |asset|
          asset.name = "#{campaign.name} Business Logo"
          asset.type = :IMAGE
          asset.image_asset = client.resource.image_asset do |img|
            img.data = image_data[:data]
            img.file_size = image_data[:file_size]
            img.mime_type = image_data[:mime_type]
            img.full_size = client.resource.image_dimension do |dim|
              dim.width_pixels = image_data[:width]
              dim.height_pixels = image_data[:height]
            end
          end
        end

        response = client.service.asset.mutate_assets(
          customer_id: customer_id,
          operations: [asset_operation]
        )

        asset_resource_name = response.results.first.resource_name
        asset_id = asset_resource_name.split("/").last.to_i
        save_asset_id(asset_id)

        link_result = link_to_campaign(asset_resource_name)
        return link_result if link_result.error?

        GoogleAds::SyncResult.created(:asset, asset_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:asset, e)
      end

      def link_to_campaign(asset_resource_name)
        link_operation = client.operation.create_resource.campaign_asset do |ca|
          ca.campaign = campaign_resource_name
          ca.asset = asset_resource_name
          ca.field_type = :BUSINESS_LOGO
        end

        client.service.campaign_asset.mutate_campaign_assets(
          customer_id: customer_id,
          operations: [link_operation]
        )

        GoogleAds::SyncResult.created(:campaign_asset, nil)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign_asset, e)
      end

      def unlink_from_campaign
        resource_name = "customers/#{customer_id}/campaignAssets/#{campaign.google_campaign_id}~#{record.google_asset_id}~BUSINESS_LOGO"
        operation = client.operation.remove_resource.campaign_asset(resource_name)
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

      # ═══════════════════════════════════════════════════════════════
      # IMAGE DATA HELPERS
      # ═══════════════════════════════════════════════════════════════

      def fetch_image_data
        file = record.file
        return nil unless file.present?

        image_path = file.path
        image_binary = File.binread(image_path)
        dimensions = get_image_dimensions(image_path)

        {
          data: Base64.strict_encode64(image_binary),
          file_size: image_binary.bytesize,
          mime_type: mime_type_for_file,
          width: dimensions[:width],
          height: dimensions[:height]
        }
      rescue => e
        Rails.logger.error("Failed to fetch image data: #{e.message}")
        nil
      end

      def get_image_dimensions(path)
        require "mini_magick"
        image = MiniMagick::Image.open(path)
        { width: image.width, height: image.height }
      rescue
        { width: 128, height: 128 }
      end

      def mime_type_for_file
        content_type = record.file.file.content_type
        case content_type
        when /png/i then :IMAGE_PNG
        when /jpeg|jpg/i then :IMAGE_JPEG
        else :IMAGE_PNG
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # HELPERS
      # ═══════════════════════════════════════════════════════════════

      def infer_campaign
        record.websites.first&.campaigns&.first
      end

      def save_asset_id(asset_id)
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "asset_id" => asset_id }))
      end

      def client
        GoogleAds.client
      end

      def customer_id
        campaign.google_customer_id.to_s
      end

      def campaign_resource_name
        "customers/#{customer_id}/campaigns/#{campaign.google_campaign_id}"
      end

      def fetch_by_id_query
        <<~GAQL.squish
          SELECT asset.resource_name, asset.id, asset.name, asset.type, asset.image_asset.file_size, asset.image_asset.mime_type
          FROM asset
          WHERE asset.id = #{record.google_asset_id}
        GAQL
      end
    end
  end
end
