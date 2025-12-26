module GoogleAds
  class AdSchedule < Sync::Syncable
    DAYS_OF_WEEK_MAP = {
      "Monday" => :MONDAY,
      "Tuesday" => :TUESDAY,
      "Wednesday" => :WEDNESDAY,
      "Thursday" => :THURSDAY,
      "Friday" => :FRIDAY,
      "Saturday" => :SATURDAY,
      "Sunday" => :SUNDAY
    }.freeze

    MINUTES_MAP = {
      0 => :ZERO,
      15 => :FIFTEEN,
      30 => :THIRTY,
      45 => :FORTY_FIVE
    }.freeze

    def campaign
      local_resource.campaign
    end

    def fetch_remote
      fetch_by_id
    end

    def fetch_by_id
      return nil unless remote_criterion_id.present?

      query = %(
        SELECT campaign_criterion.resource_name, campaign_criterion.criterion_id, campaign_criterion.campaign, campaign_criterion.ad_schedule.day_of_week, campaign_criterion.ad_schedule.start_hour, campaign_criterion.ad_schedule.start_minute, campaign_criterion.ad_schedule.end_hour, campaign_criterion.ad_schedule.end_minute, campaign_criterion.bid_modifier
        FROM campaign_criterion
        WHERE campaign_criterion.criterion_id = #{remote_criterion_id}
        AND campaign_criterion.campaign = 'customers/#{google_customer_id}/campaigns/#{google_campaign_id}'
      )

      results = client.service.google_ads.search(customer_id: google_customer_id, query: query)
      criterion = results.first&.campaign_criterion
      return nil unless criterion

      RemoteAdSchedule.new(
        resource_name: criterion.resource_name,
        criterion_id: criterion.criterion_id,
        campaign: criterion.campaign,
        day_of_week: criterion.ad_schedule.day_of_week,
        start_hour: criterion.ad_schedule.start_hour,
        start_minute: criterion.ad_schedule.start_minute,
        end_hour: criterion.ad_schedule.end_hour,
        end_minute: criterion.ad_schedule.end_minute,
        bid_modifier: criterion.bid_modifier
      )
    end

    def sync_result
      return not_found_result(:campaign_criterion) unless remote_resource

      Sync::SyncResult.new(
        resource_type: :campaign_criterion,
        resource_name: remote_resource.resource_name,
        action: :unchanged,
        comparisons: build_comparisons
      )
    end

    def sync
      return sync_result if synced?

      if remote_resource
        recreate_criterion
      else
        create_criterion
      end
    end

    def delete
      return not_found_result(:campaign_criterion) unless remote_resource

      resource_name = remote_resource.resource_name

      operation = client.operation.remove_resource.campaign_criterion(resource_name)

      begin
        client.service.campaign_criterion.mutate_campaign_criteria(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:campaign_criterion, e)
      end

      local_resource.google_criterion_id = nil
      local_resource.save!

      clear_memoization

      Sync::SyncResult.new(
        resource_type: :campaign_criterion,
        resource_name: nil,
        action: :deleted,
        comparisons: []
      )
    end

    private

    def remote_criterion_id
      local_resource.google_criterion_id
    end
    memoize :remote_criterion_id

    def google_customer_id
      campaign.google_customer_id.to_s
    end

    def google_campaign_id
      campaign.google_campaign_id.to_s
    end

    def campaign_resource_name
      "customers/#{google_customer_id}/campaigns/#{google_campaign_id}"
    end

    def google_day_of_week
      DAYS_OF_WEEK_MAP[local_resource.day_of_week]
    end

    def google_start_minute
      MINUTES_MAP[local_resource.start_minute] || :ZERO
    end

    def google_end_minute
      MINUTES_MAP[local_resource.end_minute] || :ZERO
    end

    def create_criterion
      operation = client.operation.create_resource.campaign_criterion do |cc|
        cc.campaign = campaign_resource_name
        cc.ad_schedule = client.resource.ad_schedule_info do |as|
          as.day_of_week = google_day_of_week
          as.start_hour = local_resource.start_hour
          as.start_minute = google_start_minute
          as.end_hour = local_resource.end_hour
          as.end_minute = google_end_minute
        end
        cc.bid_modifier = local_resource.bid_modifier if local_resource.bid_modifier.present?
      end

      begin
        response = client.service.campaign_criterion.mutate_campaign_criteria(
          customer_id: google_customer_id,
          operations: [operation]
        )
      rescue => e
        return error_result(:campaign_criterion, e)
      end

      resource_name = response.results.first.resource_name
      criterion_id = resource_name.split("~").last.to_i
      local_resource.google_criterion_id = criterion_id

      verify_sync(:created, resource_name)
    end

    def recreate_criterion
      remove_operation = client.operation.remove_resource.campaign_criterion(remote_resource.resource_name)

      create_operation = client.operation.create_resource.campaign_criterion do |cc|
        cc.campaign = campaign_resource_name
        cc.ad_schedule = client.resource.ad_schedule_info do |as|
          as.day_of_week = google_day_of_week
          as.start_hour = local_resource.start_hour
          as.start_minute = google_start_minute
          as.end_hour = local_resource.end_hour
          as.end_minute = google_end_minute
        end
        cc.bid_modifier = local_resource.bid_modifier if local_resource.bid_modifier.present?
      end

      begin
        response = client.service.campaign_criterion.mutate_campaign_criteria(
          customer_id: google_customer_id,
          operations: [remove_operation, create_operation]
        )
      rescue => e
        return error_result(:campaign_criterion, e)
      end

      resource_name = response.results.last.resource_name
      criterion_id = resource_name.split("~").last.to_i
      local_resource.google_criterion_id = criterion_id

      verify_sync(:updated, resource_name)
    end

    def verify_sync(action, resource_name)
      clear_memoization
      fetch_remote

      Sync::SyncResult.new(
        resource_type: :campaign_criterion,
        resource_name: resource_name,
        action: action,
        comparisons: build_comparisons
      )
    end

    def clear_memoization
      flush_cache(:remote_resource)
      flush_cache(:synced?)
      flush_cache(:sync_result)
      flush_cache(:remote_criterion_id)
    end

    class RemoteAdSchedule
      attr_reader :resource_name, :criterion_id, :campaign, :day_of_week, :start_hour, :start_minute, :end_hour, :end_minute, :bid_modifier

      def initialize(resource_name:, criterion_id:, campaign:, day_of_week:, start_hour:, start_minute:, end_hour:, end_minute:, bid_modifier:)
        @resource_name = resource_name
        @criterion_id = criterion_id
        @campaign = campaign
        @day_of_week = day_of_week
        @start_hour = start_hour
        @start_minute = start_minute
        @end_hour = end_hour
        @end_minute = end_minute
        @bid_modifier = bid_modifier
      end

      def ad_schedule
        self
      end

      def synced?
        true
      end
    end
  end
end
