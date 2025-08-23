class Cloudflare
  module Monitorable
    extend ActiveSupport::Concern

    class << self
      def monitor_zones
        # Calls actually_monitor_zones
        Cloudflare::MonitorZonesWorker::BatchWorker.perform_async
      end

      def actually_monitor_zones
        Cloudflare::Analytics::Queries::MonitorZones.new.get_all_zones do |zones|
          if zones.is_a?(Array)
            # This is a successful response, an array of zone IDs
            # such as: ["53af2b7fed23483ab370ef62a78b411b", "5ea4ca3dddb10aa3bd8f3c848ad8a95f"]
            zones.each do |zone|
              Cloudflare::TrafficWorker.perform_async(zone_id: zone)
            end
          else
            Rollbar.error("Failed to get zones", zones)
          end
        end
      end

      def monitor_zone(zone_id)
        start_time = UTC.now.beginning_of_hour
        end_time = UTC.now.end_of_hour

        # sample report: {"abeverything.com" => 16, "example.abeverything.com" => 50}
        traffic_report = Cloudflare::Analytics::Queries::MonitorZones.new.hourly_traffic_by_host(
          zone_id: zone_id,
          start_time: start_time,
          end_time: end_time
        )

        return if traffic_report.blank?

        domain_names = traffic_report.keys
        return if domain_names.empty?

        DomainRequestCount.process_traffic_report(
          traffic_report: traffic_report,
          start_time: start_time,
          zone_id: zone_id
        )
      end
    end
  end
end