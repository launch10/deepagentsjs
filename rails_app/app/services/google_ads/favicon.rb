module GoogleAds
  class Favicon < Sync::Syncable
    attr_reader :campaign

    def initialize(local_resource, campaign: nil)
      super(local_resource)
      @campaign = campaign || local_resource.websites.first&.campaigns&.first
    end

    def fetch_remote
      fetch_by_id
    end

    def fetch_by_id
      return nil unless remote_asset_id.present?

      query = %(
        SELECT asset.resource_name, asset.id, asset.name, asset.type, asset.image_asset.file_size, asset.image_asset.mime_type
        FROM asset
        WHERE asset.id = #{remote_asset_id}
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      results.first&.asset
    end

    def build_comparisons
      []
    end

    def sync_result
      return not_found_result(:asset) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :asset,
        resource_name: remote_resource.resource_name,
        action: :unchanged,
        comparisons: []
      )
    end

    def sync
      return sync_result if synced?

      if remote_resource
        sync_result
      else
        create_asset
      end
    end

    private

    def remote_asset_id
      local_resource.google_asset_id
    end
    memoize :remote_asset_id

    def google_customer_id
      campaign.google_customer_id.to_s
    end

    def google_campaign_id
      campaign.google_campaign_id.to_s
    end

    def campaign_resource_name
      "customers/#{google_customer_id}/campaigns/#{google_campaign_id}"
    end

    def create_asset
      image_data = fetch_image_data
      return error_result(:asset, StandardError.new("Could not fetch image data")) unless image_data

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

      begin
        response = client.service.asset.mutate_assets(
          customer_id: google_customer_id,
          operations: [asset_operation]
        )
      rescue => e
        return error_result(:asset, e)
      end

      asset_resource_name = response.results.first.resource_name
      asset_id = asset_resource_name.split("/").last.to_i
      local_resource.google_asset_id = asset_id
      local_resource.save!

      link_result = link_to_campaign(asset_resource_name)
      return link_result if link_result.action == :error

      verify_sync(:created, asset_resource_name)
    end

    def link_to_campaign(asset_resource_name)
      link_operation = client.operation.create_resource.campaign_asset do |ca|
        ca.campaign = campaign_resource_name
        ca.asset = asset_resource_name
        ca.field_type = :BUSINESS_LOGO
      end

      begin
        client.service.campaign_asset.mutate_campaign_assets(
          customer_id: google_customer_id,
          operations: [link_operation]
        )

        Sync::SyncResult.new(
          resource_type: :campaign_asset,
          resource_name: asset_resource_name,
          action: :created,
          comparisons: []
        )
      rescue => e
        error_result(:campaign_asset, e)
      end
    end

    def fetch_image_data
      file = local_resource.file
      return nil unless file.present?

      begin
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
    end

    def get_image_dimensions(path)
      require "mini_magick"
      image = MiniMagick::Image.open(path)
      { width: image.width, height: image.height }
    rescue
      { width: 128, height: 128 }
    end

    def mime_type_for_file
      content_type = local_resource.file.file.content_type
      case content_type
      when /png/i then :IMAGE_PNG
      when /jpeg|jpg/i then :IMAGE_JPEG
      else :IMAGE_PNG
      end
    end

    def verify_sync(action, resource_name)
      clear_memoization
      fetch_remote

      Sync::SyncResult.new(
        resource_type: :asset,
        resource_name: resource_name,
        action: action,
        comparisons: []
      )
    end

    def clear_memoization
      flush_cache(:remote_resource)
      flush_cache(:synced?)
      flush_cache(:sync_result)
      flush_cache(:remote_asset_id)
    end
  end
end
