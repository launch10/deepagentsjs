class Cloudflare
  class MonitorDomainsWorker
    include Sidekiq::Worker

    sidekiq_options queue: :critical, retry: 5

    def perform(zone_id)
      return unless Rails.env.production?

      Domain.monitor_cloudflare_zone(zone_id)
    end

    class BatchWorker
      include Sidekiq::Worker

      def perform
        return unless Rails.env.production?

        Domain.actually_monitor_cloudflare_domains
      end
    end
  end
end
