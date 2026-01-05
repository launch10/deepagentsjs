module GoogleAds
  module Resources
    class Keyword
      attr_reader :record

      def initialize(record)
        @record = record
      end

      # ═══════════════════════════════════════════════════════════════
      # CLASS METHODS: Collection Operations (AdGroup has many keywords)
      # ═══════════════════════════════════════════════════════════════

      class << self
        def synced?(ad_group)
          # Check if any soft-deleted keywords need Google cleanup
          ad_group.keywords.only_deleted.each do |keyword|
            return false if keyword.google_criterion_id.present?
          end

          # Check if all active keywords are synced
          ad_group.keywords.without_deleted.each do |keyword|
            return false unless new(keyword).synced?
          end

          true
        end

        def sync_all(ad_group)
          results = []

          # Delete soft-deleted keywords with Google IDs
          ad_group.keywords.only_deleted.each do |keyword|
            next unless keyword.google_criterion_id.present?
            results << new(keyword).delete
          end

          # Sync active keywords
          ad_group.keywords.without_deleted.each do |keyword|
            results << new(keyword).sync
          end

          Sync::CollectionSyncResult.new(results: results)
        end

        def sync_plan(ad_group)
          operations = []

          # Plan deletions
          ad_group.keywords.only_deleted.each do |keyword|
            next unless keyword.google_criterion_id.present?
            operations << {
              action: :delete,
              record: keyword,
              criterion_id: keyword.google_criterion_id
            }
          end

          # Plan syncs
          ad_group.keywords.without_deleted.each do |keyword|
            operations.concat(new(keyword).sync_plan.operations)
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
        return GoogleAds::SyncResult.unchanged(:ad_group_criterion, record.google_criterion_id) if synced?

        remote = fetch
        if remote && remote.status != :REMOVED
          update_criterion(remote)
        else
          create_criterion
        end
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:ad_group_criterion, e)
      end

      def sync_plan
        operations = []

        remote = fetch
        if remote.nil?
          operations << { action: :create, record: record, text: record.text, match_type: record.match_type }
        elsif remote.status == :REMOVED
          operations << { action: :create, record: record, text: record.text, match_type: record.match_type }
        elsif !fields_match?(remote)
          comparison = compare_fields(remote)
          operations << { action: :update, record: record, fields: comparison.failures }
        end

        Sync::Plan.new(operations)
      end

      def delete
        return GoogleAds::SyncResult.not_found(:ad_group_criterion) unless record.google_criterion_id.present?

        remove_from_google
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "criterion_id" => nil }))
        GoogleAds::SyncResult.deleted(:ad_group_criterion)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        if resource_not_found_error?(e)
          record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "criterion_id" => nil }))
          GoogleAds::SyncResult.deleted(:ad_group_criterion)
        else
          GoogleAds::SyncResult.error(:ad_group_criterion, e)
        end
      end

      def fetch
        fetch_by_id
      end

      def compare_fields(remote)
        FieldCompare.build do |c|
          c.check(:text, local: record.text, remote: remote.keyword.text) do
            record.text == remote.keyword.text
          end

          c.check(:match_type, local: record.match_type, remote: remote.keyword.match_type) do
            record.match_type.upcase.to_sym == remote.keyword.match_type
          end
        end
      end

      private

      # ═══════════════════════════════════════════════════════════════
      # API OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      def create_criterion
        operation = client.operation.create_resource.ad_group_criterion do |agc|
          agc.ad_group = ad_group_resource_name
          agc.keyword = client.resource.keyword_info do |k|
            k.text = record.text
            k.match_type = record.match_type.upcase.to_sym
          end
          agc.status = :ENABLED
        end

        response = client.service.ad_group_criterion.mutate_ad_group_criteria(
          customer_id: customer_id,
          operations: [operation]
        )

        resource_name = response.results.first.resource_name
        criterion_id = resource_name.split("~").last.to_i
        save_criterion_id(criterion_id)

        GoogleAds::SyncResult.created(:ad_group_criterion, criterion_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:ad_group_criterion, e)
      end

      def update_criterion(remote)
        comparison = compare_fields(remote)
        return GoogleAds::SyncResult.unchanged(:ad_group_criterion, record.google_criterion_id) if comparison.match?

        resource_name = remote.resource_name

        operation = client.operation.update_resource.ad_group_criterion(resource_name) do |agc|
          if comparison.failures.include?(:match_type)
            agc.keyword = client.resource.keyword_info do |k|
              k.match_type = record.match_type.upcase.to_sym
            end
          end
          if comparison.failures.include?(:text)
            agc.keyword = client.resource.keyword_info do |k|
              k.text = record.text
            end
          end
        end

        client.service.ad_group_criterion.mutate_ad_group_criteria(
          customer_id: customer_id,
          operations: [operation]
        )

        GoogleAds::SyncResult.updated(:ad_group_criterion, record.google_criterion_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:ad_group_criterion, e)
      end

      def remove_from_google
        resource_name = "customers/#{customer_id}/adGroupCriteria/#{ad_group.google_ad_group_id}~#{record.google_criterion_id}"
        operation = client.operation.remove_resource.ad_group_criterion(resource_name)
        client.service.ad_group_criterion.mutate_ad_group_criteria(
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
        results.first&.ad_group_criterion
      end

      # ═══════════════════════════════════════════════════════════════
      # FIELD TRANSFORMS
      # ═══════════════════════════════════════════════════════════════

      def fields_match?(remote)
        compare_fields(remote).match?
      end

      # ═══════════════════════════════════════════════════════════════
      # ERROR HANDLING
      # ═══════════════════════════════════════════════════════════════

      def resource_not_found_error?(error)
        error.failure.errors.any? do |err|
          err.error_code.to_h[:criterion_error] == :CANNOT_TARGET_CRITERION_TYPE_FOR_CAMPAIGNS ||
            err.error_code.to_h[:mutate_error] == :RESOURCE_NOT_FOUND
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # HELPERS
      # ═══════════════════════════════════════════════════════════════

      def save_criterion_id(criterion_id)
        record.update_column(:platform_settings, record.platform_settings.deep_merge("google" => { "criterion_id" => criterion_id }))
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

      def fetch_by_id_query
        <<~GAQL.squish
          SELECT ad_group_criterion.resource_name, ad_group_criterion.criterion_id, ad_group_criterion.ad_group, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status
          FROM ad_group_criterion
          WHERE ad_group_criterion.criterion_id = #{record.google_criterion_id}
          AND ad_group_criterion.ad_group = 'customers/#{customer_id}/adGroups/#{ad_group.google_ad_group_id}'
          AND ad_group_criterion.type = 'KEYWORD'
        GAQL
      end
    end
  end
end
