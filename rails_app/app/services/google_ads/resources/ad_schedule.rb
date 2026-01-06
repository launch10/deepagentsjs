module GoogleAds
  module Resources
    class AdSchedule
      include FieldMappable
      include Instrumentable

      attr_reader :record

      # ═══════════════════════════════════════════════════════════════
      # FIELD MAPPINGS
      # ═══════════════════════════════════════════════════════════════

      field_mapping :day_of_week,
        local: :day_of_week,
        remote: ->(cc) { cc.ad_schedule.day_of_week },
        transform: Transforms::DAY_OF_WEEK_TO_SYMBOL,
        reverse_transform: Transforms::SYMBOL_TO_DAY_OF_WEEK

      field_mapping :start_hour,
        local: :start_hour,
        remote: ->(cc) { cc.ad_schedule.start_hour }

      field_mapping :start_minute,
        local: :start_minute,
        remote: ->(cc) { cc.ad_schedule.start_minute },
        transform: Transforms::MINUTE_TO_SYMBOL,
        reverse_transform: Transforms::SYMBOL_TO_MINUTE

      field_mapping :end_hour,
        local: :end_hour,
        remote: ->(cc) { cc.ad_schedule.end_hour }

      field_mapping :end_minute,
        local: :end_minute,
        remote: ->(cc) { cc.ad_schedule.end_minute },
        transform: Transforms::MINUTE_TO_SYMBOL,
        reverse_transform: Transforms::SYMBOL_TO_MINUTE

      def initialize(db_schedule)
        @record = db_schedule
      end

      def instrumentation_context
        { campaign: record.campaign }
      end

      instrument_methods :sync, :sync_result, :sync_plan, :delete, :fetch

      # Backwards-compatible alias
      def db_schedule
        @record
      end

      def synced?
        if db_schedule.always_on?
          # For always_on: Google should have ZERO ad_schedule criteria
          # We MUST query Google - cannot trust local criterion_id
          return !any_schedules_exist_in_google?
        end

        # For specific schedules: verify Google has our criterion with matching fields
        return false unless db_schedule.google_criterion_id

        googles_schedule = fetch
        return false unless googles_schedule

        fields_match?(googles_schedule)
      end

      def sync
        if db_schedule.always_on?
          # For always_on: delete ALL schedules in Google (not just ones we know about)
          return delete_all_schedules_in_google if any_schedules_exist_in_google?
          return GoogleAds::SyncResult.unchanged(:campaign_criterion, nil)
        end

        return GoogleAds::SyncResult.unchanged(:campaign_criterion, db_schedule.google_criterion_id) if synced?

        db_schedule.google_criterion_id ? recreate : create
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign_criterion, e)
      end

      def delete
        return GoogleAds::SyncResult.not_found(:campaign_criterion) unless db_schedule.google_criterion_id

        remove_from_google
        db_schedule.update_column(:platform_settings, db_schedule.platform_settings.deep_merge("google" => { "criterion_id" => nil }))
        GoogleAds::SyncResult.deleted(:campaign_criterion)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign_criterion, e)
      end

      def fetch
        return nil unless db_schedule.google_criterion_id

        results = client.service.google_ads.search(
          customer_id: customer_id,
          query: fetch_query
        )
        results.first&.campaign_criterion
      end

      # compare_fields provided by FieldMappable

      # ═══════════════════════════════════════════════════════════════
      # SYNC PLAN - dry run planning
      #
      # Returns a Plan showing what sync() WOULD do without executing
      # ═══════════════════════════════════════════════════════════════

      def sync_plan
        if db_schedule.always_on?
          return plan_always_on_sync
        end

        plan_specific_schedule_sync
      end

      # ═══════════════════════════════════════════════════════════════
      # CLASS METHODS - Collection Operations
      #
      # These operate on all ad_schedules for a campaign
      # ═══════════════════════════════════════════════════════════════

      class << self
        # Check if all ad_schedules for a campaign are synced to Google
        #
        # Returns true if:
        # 1. No soft-deleted records have google_criterion_id
        # 2. All active records are synced
        def synced?(campaign)
          # Any soft-deleted records with criterion_id means NOT synced
          return false if campaign.ad_schedules.only_deleted.any? { |s| s.google_criterion_id.present? }

          # All active records must be synced
          campaign.ad_schedules.all? { |schedule| new(schedule).synced? }
        end

        # Sync all ad_schedules for a campaign to Google
        #
        # Performs:
        # 1. Delete soft-deleted records that have google_criterion_id
        # 2. Sync all active records
        def sync_all(campaign)
          results = []

          # Delete soft-deleted records from Google
          campaign.ad_schedules.only_deleted.each do |schedule|
            next unless schedule.google_criterion_id

            results << new(schedule).delete
          end

          # Sync all active records
          campaign.ad_schedules.each do |schedule|
            results << new(schedule).sync
          end

          Sync::CollectionSyncResult.new(results: results)
        end

        # Dry-run planning for all ad_schedules in a campaign
        #
        # Returns a Plan showing what sync_all() WOULD do:
        # 1. Deleted records with google_criterion_id → :delete operations
        # 2. Active records → delegated to their individual sync_plan
        def sync_plan(campaign)
          operations = []

          # Plan deletions for soft-deleted records that have google_criterion_id
          campaign.ad_schedules.only_deleted.each do |schedule|
            next unless schedule.google_criterion_id

            operations << {
              action: :delete,
              record: schedule,
              criterion_id: schedule.google_criterion_id
            }
          end

          # Plan syncs for active records
          campaign.ad_schedules.each do |schedule|
            record_plan = new(schedule).sync_plan
            operations.concat(record_plan.operations)
          end

          Sync::Plan.new(operations)
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # GOOGLE API OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      private

      def plan_always_on_sync
        schedules = fetch_all_schedules_in_google

        if schedules.empty?
          GoogleAds::Sync::Plan.new([{ action: :unchanged, record: db_schedule }])
        else
          operations = schedules.map do |row|
            { action: :delete, criterion_id: row.campaign_criterion.criterion_id }
          end
          GoogleAds::Sync::Plan.new(operations)
        end
      end

      def plan_specific_schedule_sync
        # No criterion_id → needs create
        unless db_schedule.google_criterion_id
          return GoogleAds::Sync::Plan.new([{ action: :create, record: db_schedule }])
        end

        # Has criterion_id → fetch from Google and check
        googles_schedule = fetch

        # Google doesn't have it → needs recreate (update)
        unless googles_schedule
          return GoogleAds::Sync::Plan.new([{
            action: :update,
            record: db_schedule,
            reason: :missing_in_google
          }])
        end

        # Google has it → check if fields match
        if fields_match?(googles_schedule)
          GoogleAds::Sync::Plan.new([{ action: :unchanged, record: db_schedule }])
        else
          GoogleAds::Sync::Plan.new([{
            action: :update,
            record: db_schedule,
            reason: :fields_mismatch
          }])
        end
      end

      # ─────────────────────────────────────────────────────────────
      # always_on helpers: Check and delete ALL schedules in Google
      # ─────────────────────────────────────────────────────────────

      def any_schedules_exist_in_google?
        fetch_all_schedules_in_google.any?
      end

      def fetch_all_schedules_in_google
        client.service.google_ads.search(
          customer_id: customer_id,
          query: all_schedules_query
        ).to_a
      end

      def delete_all_schedules_in_google
        schedules = fetch_all_schedules_in_google
        return GoogleAds::SyncResult.unchanged(:campaign_criterion, nil) if schedules.empty?

        operations = schedules.map do |row|
          criterion_id = row.campaign_criterion.criterion_id
          resource = "customers/#{customer_id}/campaignCriteria/#{db_schedule.campaign.google_campaign_id}~#{criterion_id}"
          client.operation.remove_resource.campaign_criterion(resource)
        end

        mutate(operations)
        db_schedule.update_column(:platform_settings, db_schedule.platform_settings.deep_merge("google" => { "criterion_id" => nil }))
        GoogleAds::SyncResult.deleted(:campaign_criterion)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign_criterion, e)
      end

      def all_schedules_query
        <<~GAQL.squish
          SELECT campaign_criterion.criterion_id
          FROM campaign_criterion
          WHERE campaign_criterion.campaign = '#{campaign_resource_name}'
            AND campaign_criterion.type = 'AD_SCHEDULE'
        GAQL
      end

      # ─────────────────────────────────────────────────────────────
      # Standard CRUD operations
      # ─────────────────────────────────────────────────────────────

      def create
        response = mutate([build_create_operation])
        save_criterion_id(response)
        GoogleAds::SyncResult.created(:campaign_criterion, db_schedule.google_criterion_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign_criterion, e)
      end

      def recreate
        remove_from_google
        db_schedule.update_column(:platform_settings, db_schedule.platform_settings.deep_merge("google" => { "criterion_id" => nil }))

        response = mutate([build_create_operation])
        save_criterion_id(response)
        GoogleAds::SyncResult.updated(:campaign_criterion, db_schedule.google_criterion_id)
      rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
        GoogleAds::SyncResult.error(:campaign_criterion, e)
      end

      def remove_from_google
        mutate([client.operation.remove_resource.campaign_criterion(resource_name)])
      end

      def build_create_operation
        client.operation.create_resource.campaign_criterion do |cc|
          cc.campaign = campaign_resource_name
          cc.ad_schedule = client.resource.ad_schedule_info do |s|
            s.day_of_week = attrs[:day_of_week]
            s.start_hour = attrs[:start_hour]
            s.start_minute = attrs[:start_minute]
            s.end_hour = attrs[:end_hour]
            s.end_minute = attrs[:end_minute]
          end
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # FIELD TRANSFORMS
      # ═══════════════════════════════════════════════════════════════

      # All field values with transforms applied (via to_google_json)
      def attrs
        @attrs ||= to_google_json
      end

      # fields_match? provided by FieldMappable

      # ═══════════════════════════════════════════════════════════════
      # HELPERS
      # ═══════════════════════════════════════════════════════════════

      def mutate(operations)
        client.service.campaign_criterion.mutate_campaign_criteria(
          customer_id: customer_id,
          operations: operations
        )
      end

      def save_criterion_id(response)
        criterion_id = response.results.last.resource_name.split("~").last.to_i
        db_schedule.update_column(:platform_settings, db_schedule.platform_settings.deep_merge("google" => { "criterion_id" => criterion_id }))
      end

      def client
        GoogleAds.client
      end

      def customer_id
        db_schedule.campaign.google_customer_id.to_s
      end

      def campaign_resource_name
        "customers/#{customer_id}/campaigns/#{db_schedule.campaign.google_campaign_id}"
      end

      def resource_name
        "customers/#{customer_id}/campaignCriteria/#{db_schedule.campaign.google_campaign_id}~#{db_schedule.google_criterion_id}"
      end

      def fetch_query
        <<~GAQL.squish
          SELECT
            campaign_criterion.criterion_id,
            campaign_criterion.ad_schedule.day_of_week,
            campaign_criterion.ad_schedule.start_hour,
            campaign_criterion.ad_schedule.start_minute,
            campaign_criterion.ad_schedule.end_hour,
            campaign_criterion.ad_schedule.end_minute
          FROM campaign_criterion
          WHERE campaign_criterion.criterion_id = #{db_schedule.google_criterion_id}
            AND campaign_criterion.campaign = '#{campaign_resource_name}'
        GAQL
      end
    end
  end
end
