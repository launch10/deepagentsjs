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
        start_time = UTC.now.beginning_of_hour
        end_time = UTC.now.end_of_hour

        # sample report: {"abeverything.com" => 16, "example.abeverything.com" => 50}
        traffic_report = Cloudflare::Analytics::Queries::MonitorDomains.new.hourly_traffic_by_host(
          zone_id: zone_id,
          start_time: start_time,
          end_time: end_time
        )

        DomainRequestCount.process_traffic_report(
          traffic_report: traffic_report,
          start_time: start_time,
          zone_id: zone_id
        )
      end
    end
  end
end