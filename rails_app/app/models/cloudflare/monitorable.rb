class Cloudflare
  module Monitorable
    extend ActiveSupport::Concern

    class_methods do
      def monitor_domains
        # Calls actually_monitor_domains
        Cloudflare::MonitorDomainsWorker::BatchWorker.perform_async
      end

      def actually_monitor_domains
        Cloudflare::Analytics::Queries::MonitorDomains.new.get_all_cloudflare_zones do |zones|
          if zones.is_a?(Array)
            # This is a successful response, an array of zone IDs
            # such as: ["53af2b7fed23483ab370ef62a78b411b", "5ea4ca3dddb10aa3bd8f3c848ad8a95f"]
            zones.each do |zone|
              Cloudflare::MonitorDomainsWorker.perform_async(zone)
            end
          else
            Rollbar.error("Failed to get zones", zones)
          end
        end
      end

      def monitor_cloudflare_zone(zone_id)
        start_time = EST.now.beginning_of_hour
        end_time = EST.now.end_of_hour

        DomainRequestCount.process_traffic_report(
          traffic_report: get_hourly_traffic_report(zone_id, start_time: start_time, end_time: end_time),
          start_time: start_time,
          zone_id: zone_id
        )
      end

    private
      # These methods are useful for testing, but should not be used in production
      def monitor_domains_sync
        Cloudflare::Analytics::Queries::MonitorDomains.new.get_all_cloudflare_zones do |zones|
          zones.each do |zone|
            monitor_cloudflare_zone(zone)
          end
        end
      end

      def all_traffic_reports
        reports = []
        Cloudflare::Analytics::Queries::MonitorDomains.new.get_all_cloudflare_zones do |zones|
          zones.each do |zone|
            reports << get_hourly_traffic_report(zone)
          end
        end
        reports
      end

      def get_hourly_traffic_report(zone_id, start_time: nil, end_time: nil)
        start_time ||= EST.now.beginning_of_hour
        end_time ||= EST.now.end_of_hour

        Cloudflare::Analytics::Queries::MonitorDomains.new.hourly_traffic_by_host(
          zone_id: zone_id,
          start_time: start_time,
          end_time: end_time
        )
      end

    end
  end
end