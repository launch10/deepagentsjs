module GoogleAds
  class StructuredSnippet < Sync::Syncable
    def campaign
      local_resource.campaign
    end

    def fetch_remote
      fetch_by_id || fetch_by_content
    end

    def fetch_by_id
      return nil unless remote_asset_id.present?

      query = %(
        SELECT asset.id, asset.resource_name, asset.structured_snippet_asset.header, asset.structured_snippet_asset.values
        FROM asset
        WHERE asset.id = #{remote_asset_id}
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
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
      return nil unless local_resource.category.present?

      query = %(
        SELECT asset.id, asset.resource_name, asset.structured_snippet_asset.header, asset.structured_snippet_asset.values
        FROM asset
        WHERE asset.type = 'STRUCTURED_SNIPPET'
          AND asset.structured_snippet_asset.header = '#{header_for_category}'
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      asset = results.find { |row| row.asset.structured_snippet_asset.values == local_resource.values }&.asset
      return nil unless asset

      local_resource.update_column(:platform_settings,
        local_resource.platform_settings.deep_merge("google" => { "asset_id" => asset.id.to_s }))

      RemoteStructuredSnippet.new(
        resource_name: asset.resource_name,
        id: asset.id,
        header: asset.structured_snippet_asset.header,
        values: asset.structured_snippet_asset.values.to_a
      )
    end

    def sync_result
      return not_found_result(:asset) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :asset,
        resource_name: remote_resource.resource_name,
        action: :unchanged,
        comparisons: build_comparisons
      )
    end

    def sync
      return sync_result if synced?

      if remote_resource
        sync_result
      else
        create_structured_snippet_asset
      end
    end

    def delete
      return not_found_result(:campaign_asset) unless remote_asset_id.present?

      campaign_asset_resource_name = "customers/#{google_customer_id}/campaignAssets/#{google_campaign_id}~#{remote_asset_id}~STRUCTURED_SNIPPET"

      operation = client.operation.remove_resource.campaign_asset(campaign_asset_resource_name)

      begin
        client.service.campaign_asset.mutate_campaign_assets(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:campaign_asset, e)
      end

      local_resource.google_asset_id = nil
      local_resource.save!

      clear_memoization

      Sync::SyncResult.new(
        resource_type: :campaign_asset,
        resource_name: nil,
        action: :deleted,
        comparisons: []
      )
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

    def header_for_category
      StructuredSnippetCategoriesConfig.definitions.dig(local_resource.category, :key) || local_resource.category.titleize
    end

    def create_structured_snippet_asset
      asset_operation = client.operation.create_resource.asset do |asset|
        asset.structured_snippet_asset = client.resource.structured_snippet_asset do |snippet|
          snippet.header = header_for_category
          local_resource.values.each { |v| snippet.values << v }
        end
      end

      begin
        asset_response = client.service.asset.mutate_assets(
          customer_id: google_customer_id,
          operations: [asset_operation]
        )
      rescue => e
        return error_result(:asset, e)
      end

      asset_resource_name = asset_response.results.first.resource_name
      asset_id = asset_resource_name.split("/").last.to_i
      local_resource.google_asset_id = asset_id
      local_resource.save!

      link_operation = client.operation.create_resource.campaign_asset do |ca|
        ca.campaign = campaign_resource_name
        ca.asset = asset_resource_name
        ca.field_type = :STRUCTURED_SNIPPET
      end

      begin
        client.service.campaign_asset.mutate_campaign_assets(
          customer_id: google_customer_id,
          operations: [link_operation]
        )
      rescue => e
        return error_result(:campaign_asset, e)
      end

      verify_sync(:created, asset_resource_name)
    end

    def verify_sync(action, resource_name)
      clear_memoization
      fetch_remote

      Sync::SyncResult.new(
        resource_type: :asset,
        resource_name: resource_name,
        action: action,
        comparisons: build_comparisons
      )
    end

    def clear_memoization
      flush_cache(:remote_resource)
      flush_cache(:synced?)
      flush_cache(:sync_result)
      flush_cache(:remote_asset_id)
    end

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

      def synced?
        true
      end
    end
  end
end
