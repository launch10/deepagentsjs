module GoogleAds
  module Resources
    class AdSchedule
      DAY_MAP = {
        "Monday" => :MONDAY, "Tuesday" => :TUESDAY, "Wednesday" => :WEDNESDAY,
        "Thursday" => :THURSDAY, "Friday" => :FRIDAY,
        "Saturday" => :SATURDAY, "Sunday" => :SUNDAY
      }.freeze

      MINUTE_MAP = { 0 => :ZERO, 15 => :FIFTEEN, 30 => :THIRTY, 45 => :FORTY_FIVE }.freeze

      attr_reader :db_schedule

      def initialize(db_schedule)
        @db_schedule = db_schedule
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

      def compare_fields(remote)
        s = remote.ad_schedule

        FieldCompare.build do |c|
          c.check(:day_of_week, local: google_day_of_week, remote: s.day_of_week) { google_day_of_week == s.day_of_week }
          c.check(:start_hour, local: db_schedule.start_hour, remote: s.start_hour) { db_schedule.start_hour == s.start_hour }
          c.check(:start_minute, local: google_start_minute, remote: s.start_minute) { google_start_minute == s.start_minute }
          c.check(:end_hour, local: db_schedule.end_hour, remote: s.end_hour) { db_schedule.end_hour == s.end_hour }
          c.check(:end_minute, local: google_end_minute, remote: s.end_minute) { google_end_minute == s.end_minute }
          c.check(:bid_modifier, local: db_schedule.bid_modifier, remote: remote.bid_modifier) { FieldCompare.float_match?(db_schedule.bid_modifier || 1.0, remote.bid_modifier || 1.0) }
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # GOOGLE API OPERATIONS
      # ═══════════════════════════════════════════════════════════════

      private

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
            s.day_of_week = google_day_of_week
            s.start_hour = db_schedule.start_hour
            s.start_minute = google_start_minute
            s.end_hour = db_schedule.end_hour
            s.end_minute = google_end_minute
          end
          cc.bid_modifier = db_schedule.bid_modifier if db_schedule.bid_modifier.present?
        end
      end

      # ═══════════════════════════════════════════════════════════════
      # FIELD TRANSFORMS
      # ═══════════════════════════════════════════════════════════════

      def google_day_of_week
        DAY_MAP[db_schedule.day_of_week]
      end

      def google_start_minute
        MINUTE_MAP[db_schedule.start_minute] || :ZERO
      end

      def google_end_minute
        MINUTE_MAP[db_schedule.end_minute] || :ZERO
      end

      def fields_match?(remote)
        compare_fields(remote).match?
      end

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
            campaign_criterion.ad_schedule.end_minute,
            campaign_criterion.bid_modifier
          FROM campaign_criterion
          WHERE campaign_criterion.criterion_id = #{db_schedule.google_criterion_id}
            AND campaign_criterion.campaign = '#{campaign_resource_name}'
        GAQL
      end
    end
  end
end