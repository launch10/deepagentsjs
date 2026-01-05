module GoogleAds
  module Resources
    class Ad
      attr_reader :record

      def initialize(record)
        @record = record
      end

      # ═══════════════════════════════════════════════════════════════
      # CLASS METHODS: Collection Operations
      # ═══════════════════════════════════════════════════════════════

      class << self
        def synced?(ad_group)
          # Any soft-deleted records with ad_id means NOT synced
          return false if ad_group.ads.only_deleted.any? { |ad| ad.google_ad_id.present? }

          # All active records must be synced
          ad_group.ads.without_deleted.all? { |ad| new(ad).synced? }
        end

        def sync_all(ad_group)
          results = []

          # Delete soft-deleted records from Google
          ad_group.ads.only_deleted.each do |ad|
            next unless ad.google_ad_id

            results << new(ad).delete
          end

          # Sync all active records
          ad_group.ads.without_deleted.each do |ad|
            results << new(ad).sync
          end

          Sync::CollectionSyncResult.new(results: results)
        end

        def sync_plan(ad_group)
          operations = []

          # Plan deletions for soft-deleted records that have google_ad_id
          ad_group.ads.only_deleted.each do |ad|
            next unless ad.google_ad_id

            operations << {
              action: :delete,
              record: ad,
              ad_id: ad.google_ad_id
            }
          end

          # Plan syncs for active records
          ad_group.ads.without_deleted.each do |ad|
            record_plan = new(ad).sync_plan
            operations.concat(record_plan.operations)
          end

          Sync::Plan.new(operations)
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # INSTANCE METHODS (5 methods)
      # ═══════════════════════════════════════════════════════════════

      def synced?
        return false unless record.google_ad_id

        remote = fetch
        return false unless remote
        return false if remote.status == :REMOVED

        fields_match?(remote)
      end

      def sync
        return GoogleAds::SyncResult.unchanged(:ad_group_ad, record.google_ad_id) if synced?

        if record.google_ad_id && fetch
          update
        else
          create
        end
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:ad_group_ad, e)
      end

      def sync_plan
        operations = []

        remote = fetch
        if remote.nil?
          operations << { action: :create, record: record }
        elsif !fields_match?(remote)
          # Only status can be updated in-place
          operations << { action: :update, record: record, fields: [:status] }
        else
          operations << { action: :unchanged, record: record }
        end

        Sync::Plan.new(operations)
      end

      def delete
        return GoogleAds::SyncResult.not_found(:ad_group_ad) unless record.google_ad_id

        remove_from_google
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "ad_id" => nil }))
        GoogleAds::SyncResult.deleted(:ad_group_ad)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:ad_group_ad, e)
      end

      def fetch
        return nil unless record.google_ad_id

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_query
        )
        row = results.first
        return nil unless row

        row.ad_group_ad
      end

      def compare_fields(remote)
        FieldCompare.build do |c|
          c.check(:status, local: google_status, remote: remote.status) { google_status == remote.status }
          c.check(:display_path_1, local: record.display_path_1, remote: remote_path1(remote)) { normalize_path(record.display_path_1) == normalize_path(remote_path1(remote)) }
          c.check(:display_path_2, local: record.display_path_2, remote: remote_path2(remote)) { normalize_path(record.display_path_2) == normalize_path(remote_path2(remote)) }
        end
      end

      private

      # ═══════════════════════════════════════════════════════════════
      # API OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      def create
        operation = client.operation.create_resource.ad_group_ad do |aga|
          aga.ad_group = ad_group_resource_name
          aga.status = google_status
          aga.ad = client.resource.ad do |ad|
            ad.final_urls += record.final_urls
            ad.responsive_search_ad = client.resource.responsive_search_ad_info do |rsa|
              record.headlines.order(:position).each do |headline|
                rsa.headlines << build_headline_asset(headline)
              end
              record.descriptions.order(:position).each do |description|
                rsa.descriptions << build_description_asset(description)
              end
              rsa.path1 = record.display_path_1 if record.display_path_1.present?
              rsa.path2 = record.display_path_2 if record.display_path_2.present?
            end
          end
        end

        response = client.service.ad_group_ad.mutate_ad_group_ads(
          customer_id: customer_id,
          operations: [operation]
        )

        save_ad_id(response)
        GoogleAds::SyncResult.created(:ad_group_ad, record.google_ad_id)
      end

      def update
        remote = fetch
        resource_name = remote.resource_name

        operation = client.operation.update_resource.ad_group_ad(resource_name) do |aga|
          aga.status = google_status
        end

        client.service.ad_group_ad.mutate_ad_group_ads(
          customer_id: customer_id,
          operations: [operation]
        )

        GoogleAds::SyncResult.updated(:ad_group_ad, record.google_ad_id)
      end

      def remove_from_google
        remote = fetch
        raise Google::Ads::GoogleAds::Errors::GoogleAdsError.new("Ad not found in Google") unless remote

        operation = client.operation.remove_resource.ad_group_ad(remote.resource_name)
        client.service.ad_group_ad.mutate_ad_group_ads(
          customer_id: customer_id,
          operations: [operation]
        )
      end

      # ═══════════════════════════════════════════════════════════════
      # HEADLINE/DESCRIPTION BUILDING WITH PINNING
      # ═══════════════════════════════════════════════════════════════

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

      # ═══════════════════════════════════════════════════════════════
      # FIELD TRANSFORMS
      # ═══════════════════════════════════════════════════════════════

      def google_status
        case record.status
        when "active" then :ENABLED
        else :PAUSED
        end
      end

      def fields_match?(remote)
        compare_fields(remote).match?
      end

      def normalize_path(value)
        value.presence
      end

      def remote_path1(remote)
        remote.ad&.responsive_search_ad&.path1
      end

      def remote_path2(remote)
        remote.ad&.responsive_search_ad&.path2
      end

      # ═══════════════════════════════════════════════════════════════
      # HELPERS
      # ═══════════════════════════════════════════════════════════════

      def save_ad_id(response)
        resource_name = response.results.first.resource_name
        ad_id = resource_name.split("~").last.to_i
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "ad_id" => ad_id }))
      end

      def client
        GoogleAds.client
      end

      def customer_id
        campaign.google_customer_id.to_s
      end

      def ad_group
        record.ad_group
      end

      def campaign
        ad_group.campaign
      end

      def ad_group_resource_name
        "customers/#{customer_id}/adGroups/#{ad_group.google_ad_group_id}"
      end

      def fetch_query
        <<~GAQL.squish
          SELECT ad_group_ad.resource_name, ad_group_ad.ad.id, ad_group_ad.ad.final_urls,
                 ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions,
                 ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2,
                 ad_group_ad.status
          FROM ad_group_ad
          WHERE ad_group_ad.ad.id = #{record.google_ad_id}
          AND ad_group_ad.ad_group = '#{ad_group_resource_name}'
        GAQL
      end
    end
  end
end
