module GoogleAds
  module Resources
    class LocationTarget
      include FieldMappable
      include Instrumentable

      attr_reader :record

      # ═══════════════════════════════════════════════════════════════
      # FIELD MAPPINGS
      # ═══════════════════════════════════════════════════════════════

      # negative = !targeted (excluded locations are negative=true in Google)
      field_mapping :negative,
        local: ->(r) { !r.targeted },
        remote: :negative,
        reverse_transform: ->(val) { !val }

      def initialize(record)
        @record = record
      end

      def instrumentation_context
        { campaign: record.campaign }
      end

      instrument_methods :sync, :sync_result, :sync_plan, :delete, :fetch

      # ═══════════════════════════════════════════════════════════════
      # CLASS METHODS: Collection Operations (Campaign has many location_targets)
      # ═══════════════════════════════════════════════════════════════

      class << self
        def synced?(campaign)
          # Check if any soft-deleted location targets need Google cleanup
          campaign.location_targets.only_deleted.each do |target|
            return false if target.google_criterion_id.present?
          end

          # Check if all active location targets are synced
          campaign.location_targets.without_deleted.each do |target|
            return false unless new(target).synced?
          end

          true
        end

        def sync_all(campaign)
          results = []

          # Delete soft-deleted location targets with Google IDs
          campaign.location_targets.only_deleted.each do |target|
            next unless target.google_criterion_id.present?
            results << new(target).delete
          end

          # Sync active location targets
          campaign.location_targets.without_deleted.each do |target|
            results << new(target).sync
          end

          ::GoogleAds::Sync::CollectionSyncResult.new(results: results)
        end

        def sync_result(campaign)
          results = []
          campaign.location_targets.only_deleted.each do |lt|
            next unless lt.google_criterion_id.present?
            results << new(lt).sync_result
          end
          campaign.location_targets.without_deleted.each do |lt|
            results << new(lt).sync_result
          end
          ::GoogleAds::Sync::CollectionSyncResult.new(results: results)
        end

        def sync_plan(campaign)
          operations = []

          # Plan deletions
          campaign.location_targets.only_deleted.each do |target|
            next unless target.google_criterion_id.present?
            operations << {
              action: :delete,
              record: target,
              criterion_id: target.google_criterion_id
            }
          end

          # Plan syncs
          campaign.location_targets.without_deleted.each do |target|
            operations.concat(new(target).sync_plan.operations)
          end

          ::GoogleAds::Sync::Plan.new(operations)
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # INSTANCE METHODS (5 methods)
      # ═══════════════════════════════════════════════════════════════

      def synced?
        return false unless record.google_criterion_id.present?
        remote = fetch
        return false unless remote
        fields_match?(remote)
      end

      def sync
        return GoogleAds::SyncResult.unchanged(:campaign_criterion, record.google_criterion_id) if synced?

        remote = fetch
        if remote
          update_criterion(remote)
        else
          create_criterion
        end
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign_criterion, e)
      end

      def sync_result
        return GoogleAds::SyncResult.not_found(:campaign_criterion) unless record.google_criterion_id.present?
        remote = fetch
        return GoogleAds::SyncResult.not_found(:campaign_criterion) unless remote
        if fields_match?(remote)
          GoogleAds::SyncResult.unchanged(:campaign_criterion, record.google_criterion_id)
        else
          comparison = compare_fields(remote)
          GoogleAds::SyncResult.error(:campaign_criterion,
            GoogleAds::SyncVerificationError.new(
              "Location target sync verification failed. Mismatched fields: #{comparison.failures.join(", ")}"
            ))
        end
      end

      def sync_plan
        operations = []

        remote = fetch
        if remote.nil?
          operations << {
            action: :create,
            record: record,
            geo_target_constant: record.google_geo_target_constant,
            negative: attrs[:negative]
          }
        elsif !fields_match?(remote)
          comparison = compare_fields(remote)
          operations << { action: :update, record: record, fields: comparison.failures }
        else
          operations << { action: :unchanged, record: record }
        end

        GoogleAds::Sync::Plan.new(operations)
      end

      def delete
        return GoogleAds::SyncResult.not_found(:campaign_criterion) unless record.google_criterion_id.present?

        remove_from_google
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "criterion_id" => nil }))
        GoogleAds::SyncResult.deleted(:campaign_criterion)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        if resource_not_found_error?(e)
          record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "criterion_id" => nil }))
          GoogleAds::SyncResult.deleted(:campaign_criterion)
        else
          GoogleAds::SyncResult.error(:campaign_criterion, e)
        end
      end

      def fetch
        fetch_by_id
      end

      # compare_fields provided by FieldMappable

      private

      # ═══════════════════════════════════════════════════════════════
      # API OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      def create_criterion
        operation = client.operation.create_resource.campaign_criterion do |cc|
          # Non-mapped fields
          cc.campaign = campaign_resource_name
          cc.location = client.resource.location_info do |li|
            li.geo_target_constant = record.google_geo_target_constant
          end

          # Mapped fields (transforms applied via to_google_json)
          cc.negative = attrs[:negative]
        end

        response = client.service.campaign_criterion.mutate_campaign_criteria(
          customer_id: customer_id,
          operations: [operation]
        )

        resource_name = response.results.first.resource_name
        criterion_id = resource_name.split("~").last.to_i
        save_criterion_id(criterion_id)

        GoogleAds::SyncResult.created(:campaign_criterion, criterion_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign_criterion, e)
      end

      def update_criterion(remote)
        comparison = compare_fields(remote)
        return GoogleAds::SyncResult.unchanged(:campaign_criterion, record.google_criterion_id) if comparison.match?

        resource_name = remote.resource_name

        operation = client.operation.update_resource.campaign_criterion(resource_name) do |cc|
          # Only update changed fields, using pre-transformed attrs
          cc.negative = attrs[:negative] if comparison.failures.include?(:negative)
        end

        client.service.campaign_criterion.mutate_campaign_criteria(
          customer_id: customer_id,
          operations: [operation]
        )

        GoogleAds::SyncResult.updated(:campaign_criterion, record.google_criterion_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign_criterion, e)
      end

      def remove_from_google
        resource_name = "customers/#{customer_id}/campaignCriteria/#{google_campaign_id}~#{record.google_criterion_id}"
        operation = client.operation.remove_resource.campaign_criterion(resource_name)
        client.service.campaign_criterion.mutate_campaign_criteria(
          customer_id: customer_id,
          operations: [operation]
        )
      end

      # ═══════════════════════════════════════════════════════════════
      # FETCH HELPERS
      # ═══════════════════════════════════════════════════════════════

      def fetch_by_id
        return nil unless record.google_criterion_id.present?

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_by_id_query
        )
        results.first&.campaign_criterion
      end

      # fields_match? provided by FieldMappable

      # ═══════════════════════════════════════════════════════════════
      # ERROR HANDLING
      # ═══════════════════════════════════════════════════════════════

      def resource_not_found_error?(error)
        error.failure.errors.any? do |err|
          err.error_code.to_h[:criterion_error] == :CRITERION_NOT_FOUND ||
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

      def save_criterion_id(criterion_id)
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "criterion_id" => criterion_id.to_s }))
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
          SELECT campaign_criterion.resource_name, campaign_criterion.criterion_id, campaign_criterion.campaign, campaign_criterion.location.geo_target_constant, campaign_criterion.negative
          FROM campaign_criterion
          WHERE campaign_criterion.criterion_id = #{record.google_criterion_id}
          AND campaign_criterion.campaign = 'customers/#{customer_id}/campaigns/#{google_campaign_id}'
        GAQL
      end
    end
  end
end
