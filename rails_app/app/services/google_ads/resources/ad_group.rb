module GoogleAds
  module Resources
    class AdGroup
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
        transform: Transforms::TO_SYMBOL,
        reverse_transform: Transforms::TO_STRING

      field_mapping :type,
        local: :google_type,
        remote: :type,
        transform: Transforms::TO_SYMBOL,
        reverse_transform: Transforms::TO_STRING,
        immutable: true

      field_mapping :cpc_bid_micros,
        local: :google_cpc_bid_micros,
        remote: :cpc_bid_micros

      def initialize(record)
        @record = record
      end

      def instrumentation_context
        { ad_group: record }
      end

      # ═══════════════════════════════════════════════════════════════
      # CLASS METHODS: Collection Operations
      # ═══════════════════════════════════════════════════════════════

      class << self
        def synced?(campaign)
          # Any soft-deleted records with ad_group_id means NOT synced
          return false if campaign.ad_groups.only_deleted.any? { |ag| ag.google_ad_group_id.present? }

          # All active records must be synced
          campaign.ad_groups.without_deleted.all? { |ag| new(ag).synced? }
        end

        def sync_all(campaign)
          results = []

          # Delete soft-deleted records from Google
          campaign.ad_groups.only_deleted.each do |ad_group|
            next unless ad_group.google_ad_group_id

            results << new(ad_group).delete
          end

          # Sync all active records
          campaign.ad_groups.without_deleted.each do |ad_group|
            results << new(ad_group).sync
          end

          Sync::CollectionSyncResult.new(results: results)
        end

        def sync_plan(campaign)
          operations = []

          # Plan deletions for soft-deleted records that have google_ad_group_id
          campaign.ad_groups.only_deleted.each do |ad_group|
            next unless ad_group.google_ad_group_id

            operations << {
              action: :delete,
              record: ad_group,
              ad_group_id: ad_group.google_ad_group_id
            }
          end

          # Plan syncs for active records
          campaign.ad_groups.without_deleted.each do |ad_group|
            record_plan = new(ad_group).sync_plan
            operations.concat(record_plan.operations)
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
        return GoogleAds::SyncResult.unchanged(:ad_group, record.google_ad_group_id) if synced?

        if record.google_ad_group_id && fetch
          update
        else
          create
        end
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:ad_group, e)
      end

      # Returns a SyncResult representing the current sync state without performing any sync.
      # Used by CampaignDeploy steps to check if the sync is complete.
      def sync_result
        remote = fetch
        return GoogleAds::SyncResult.not_found(:ad_group) unless remote
        return GoogleAds::SyncResult.not_found(:ad_group) if remote.status == :REMOVED

        if fields_match?(remote)
          GoogleAds::SyncResult.unchanged(:ad_group, record.google_ad_group_id)
        else
          comparison = compare_fields(remote)
          GoogleAds::SyncResult.error(
            :ad_group,
            GoogleAds::SyncVerificationError.new(
              "AdGroup sync verification failed. Mismatched fields: #{comparison.failures.join(", ")}"
            )
          )
        end
      end

      def sync_plan
        operations = []

        remote = fetch
        if remote.nil?
          operations << { action: :create, record: record }
        elsif !fields_match?(remote)
          comparison = compare_fields(remote)
          # Only include mutable fields (not type)
          mutable_mismatches = comparison.failures - [:type]
          operations << { action: :update, record: record, fields: mutable_mismatches } if mutable_mismatches.any?
        else
          operations << { action: :unchanged, record: record }
        end

        Sync::Plan.new(operations)
      end

      def delete
        return GoogleAds::SyncResult.not_found(:ad_group) unless record.google_ad_group_id

        remove_from_google
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "ad_group_id" => nil }))
        GoogleAds::SyncResult.deleted(:ad_group)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:ad_group, e)
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

      def create
        operation = client.operation.create_resource.ad_group do |ag|
          # Mapped fields (transforms applied via to_google_json)
          ag.name = attrs[:name]
          ag.type = attrs[:type]
          ag.status = attrs[:status]
          ag.cpc_bid_micros = attrs[:cpc_bid_micros]

          # Non-mapped fields
          ag.campaign = campaign_resource_name
        end

        response = client.service.ad_group.mutate_ad_groups(
          customer_id: customer_id,
          operations: [operation]
        )

        save_ad_group_id(response)
        GoogleAds::SyncResult.created(:ad_group, record.google_ad_group_id)
      end

      def update
        remote = fetch
        resource_name = remote.resource_name
        comparison = compare_fields(remote)
        mutable_mismatches = comparison.failures - [:type]

        operation = client.operation.update_resource.ad_group(resource_name) do |ag|
          # Only update changed mutable fields, using pre-transformed attrs
          ag.name = attrs[:name] if mutable_mismatches.include?(:name)
          ag.status = attrs[:status] if mutable_mismatches.include?(:status)
          ag.cpc_bid_micros = attrs[:cpc_bid_micros] if mutable_mismatches.include?(:cpc_bid_micros)
        end

        client.service.ad_group.mutate_ad_groups(
          customer_id: customer_id,
          operations: [operation]
        )

        GoogleAds::SyncResult.updated(:ad_group, record.google_ad_group_id)
      end

      def remove_from_google
        remote = fetch
        raise Google::Ads::GoogleAds::Errors::GoogleAdsError.new("AdGroup not found in Google") unless remote

        operation = client.operation.remove_resource.ad_group(remote.resource_name)
        client.service.ad_group.mutate_ad_groups(
          customer_id: customer_id,
          operations: [operation]
        )
      end

      # ═══════════════════════════════════════════════════════════════
      # FETCH HELPERS
      # ═══════════════════════════════════════════════════════════════

      def fetch_by_id
        return nil unless record.google_ad_group_id.present?

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_by_id_query
        )
        results.first&.ad_group
      end

      def fetch_by_name
        return nil unless record.name.present?

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_by_name_query
        )
        row = results.first
        return nil unless row

        # Backfill the ID if found by name
        backfill_ad_group_id(row.ad_group.id)
        row.ad_group
      end

      # ═══════════════════════════════════════════════════════════════
      # HELPERS
      # ═══════════════════════════════════════════════════════════════

      # All field values with transforms applied (via to_google_json)
      def attrs
        @attrs ||= to_google_json
      end

      def save_ad_group_id(response)
        resource_name = response.results.first.resource_name
        ad_group_id = resource_name.split("/").last.to_i
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "ad_group_id" => ad_group_id }))
      end

      def backfill_ad_group_id(id)
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "ad_group_id" => id }))
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

      def fetch_by_id_query
        <<~GAQL.squish
          SELECT ad_group.resource_name, ad_group.id, ad_group.name, ad_group.status, ad_group.type, ad_group.cpc_bid_micros
          FROM ad_group
          WHERE ad_group.id = #{record.google_ad_group_id}
        GAQL
      end

      def fetch_by_name_query
        <<~GAQL.squish
          SELECT ad_group.resource_name, ad_group.id, ad_group.name, ad_group.status, ad_group.type, ad_group.cpc_bid_micros
          FROM ad_group
          WHERE ad_group.name = '#{record.name.gsub("'", "\\'")}'
          AND ad_group.campaign = '#{campaign_resource_name}'
        GAQL
      end
    end
  end
end
