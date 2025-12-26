module GoogleAds
  class Ad < Sync::Syncable
    def ad
      local_resource
    end

    def ad_group
      local_resource.ad_group
    end

    def campaign
      ad_group.campaign
    end

    def fetch_remote
      fetch_by_id
    end

    def fetch_by_id
      return nil unless remote_ad_id.present?

      query = %(
        SELECT ad_group_ad.resource_name, ad_group_ad.ad.id, ad_group_ad.ad.final_urls,
               ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions,
               ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2,
               ad_group_ad.status
        FROM ad_group_ad
        WHERE ad_group_ad.ad.id = #{remote_ad_id}
        AND ad_group_ad.ad_group = 'customers/#{google_customer_id}/adGroups/#{google_ad_group_id}'
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      ad_group_ad = results.first&.ad_group_ad
      return nil unless ad_group_ad

      RemoteAd.new(
        resource_name: ad_group_ad.resource_name,
        id: ad_group_ad.ad.id,
        status: ad_group_ad.status,
        final_urls: ad_group_ad.ad.final_urls.to_a,
        headlines: ad_group_ad.ad.responsive_search_ad&.headlines&.to_a || [],
        descriptions: ad_group_ad.ad.responsive_search_ad&.descriptions&.to_a || [],
        path1: ad_group_ad.ad.responsive_search_ad&.path1,
        path2: ad_group_ad.ad.responsive_search_ad&.path2
      )
    end

    def sync_result
      return not_found_result(:ad_group_ad) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :ad_group_ad,
        resource_name: remote_resource.resource_name,
        action: :unchanged,
        comparisons: build_comparisons
      )
    end

    def sync
      return sync_result if synced?

      if remote_resource
        update_ad
      else
        create_ad
      end
    end

    private

    def remote_ad_id
      local_resource.google_ad_id
    end
    memoize :remote_ad_id

    def google_customer_id
      campaign.google_customer_id.to_s
    end

    def google_ad_group_id
      ad_group.google_ad_group_id.to_s
    end

    def ad_group_resource_name
      "customers/#{google_customer_id}/adGroups/#{google_ad_group_id}"
    end

    def create_ad
      operation = client.operation.create_resource.ad_group_ad do |aga|
        aga.ad_group = ad_group_resource_name
        aga.status = google_status
        aga.ad = client.resource.ad do |ad|
          ad.final_urls += local_resource.final_urls
          ad.responsive_search_ad = client.resource.responsive_search_ad_info do |rsa|
            local_resource.headlines.order(:position).each do |headline|
              rsa.headlines << build_headline_asset(headline)
            end
            local_resource.descriptions.order(:position).each do |description|
              rsa.descriptions << build_description_asset(description)
            end
            rsa.path1 = local_resource.display_path_1 if local_resource.display_path_1.present?
            rsa.path2 = local_resource.display_path_2 if local_resource.display_path_2.present?
          end
        end
      end

      begin
        response = client.service.ad_group_ad.mutate_ad_group_ads(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:ad_group_ad, e)
      end

      resource_name = response.results.first.resource_name
      ad_id = resource_name.split("~").last.to_i
      local_resource.google_ad_id = ad_id

      verify_sync(:created, resource_name)
    end

    def build_headline_asset(headline)
      client.resource.ad_text_asset do |asset|
        asset.text = headline.text
        if headline.position <= 2
          asset.pinned_field = pinned_headline_field(headline.position)
        end
      end
    end

    def build_description_asset(description)
      client.resource.ad_text_asset do |asset|
        asset.text = description.text
        if description.position <= 1
          asset.pinned_field = pinned_description_field(description.position)
        end
      end
    end

    def pinned_headline_field(position)
      case position
      when 0 then :HEADLINE_1
      when 1 then :HEADLINE_2
      when 2 then :HEADLINE_3
      end
    end

    def pinned_description_field(position)
      case position
      when 0 then :DESCRIPTION_1
      when 1 then :DESCRIPTION_2
      end
    end

    def google_status
      case local_resource.status
      when "active" then :ENABLED
      else :PAUSED
      end
    end

    def update_ad
      resource_name = remote_resource.resource_name

      operation = client.operation.update_resource.ad_group_ad(resource_name) do |aga|
        aga.status = google_status
      end

      begin
        client.service.ad_group_ad.mutate_ad_group_ads(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:ad_group_ad, e)
      end

      verify_sync(:updated, resource_name)
    end

    def verify_sync(action, resource_name)
      clear_memoization
      fetch_remote

      Sync::SyncResult.new(
        resource_type: :ad_group_ad,
        resource_name: resource_name,
        action: action,
        comparisons: build_comparisons
      )
    end

    def clear_memoization
      flush_cache(:remote_resource)
      flush_cache(:synced?)
      flush_cache(:sync_result)
      flush_cache(:remote_ad_id)
    end

    class RemoteAd
      attr_reader :resource_name, :id, :status, :final_urls, :headlines, :descriptions, :path1, :path2

      def initialize(resource_name:, id:, status:, final_urls:, headlines:, descriptions:, path1:, path2:)
        @resource_name = resource_name
        @id = id
        @status = status
        @final_urls = final_urls
        @headlines = headlines
        @descriptions = descriptions
        @path1 = path1
        @path2 = path2
      end

      def ad
        self
      end

      def responsive_search_ad
        self
      end

      def synced?
        status != :REMOVED
      end
    end
  end
end
