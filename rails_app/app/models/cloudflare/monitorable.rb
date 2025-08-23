class Cloudflare
  module Monitorable
    extend ActiveSupport::Concern

    class << self
      def monitor_zones
        Cloudflare::Analytics::Queries::TrafficQueries.new.get_all_zones do |zones|
          zones.each do |zone|
            Cloudflare::TrafficMonitorWorker.perform_async(zone_id: zone)
          end
        end
      end

      def monitor_zone(options = {})
        options = options.with_indifferent_access
        zone_id = options[:zone_id]
        raise ArgumentError, "Missing zone_id" unless zone_id

        start_time = EST.now.beginning_of_hour
        end_time = EST.now.end_of_hour

        # sample report: {"abeverything.com" => 16, "example.abeverything.com" => 50}
        traffic_report = Cloudflare::Analytics::Queries::TrafficQueries.new.hourly_traffic_by_host(
          zone_id: zone_id,
          start_time: start_time,
          end_time: end_time
        )

        return if traffic_report.blank?

        domain_names = traffic_report.keys
        return if domain_names.empty?

        # Process traffic data and store domain request counts
        domain_counts = DomainRequestCount.process_traffic_report(
          traffic_report: traffic_report,
          start_time: start_time,
          zone_id: zone_id
        )
        
        # Update user's monthly request count
        update_user_request_count(user, domain_counts, start_time)
        
        # Check if user has exceeded their plan limits
        check_and_enforce_limits(user, website)
      end

  
    end
  end
end