class Cloudflare
  class MonitorDomainsWorker
    include Sidekiq::Worker

    sidekiq_options queue: :critical, retry: 5

    def perform(zone_id)
      Domain.monitor_cloudflare_zone(zone_id)
    end

    class BatchWorker 
      include Sidekiq::Worker
      
      def perform
        Domain.actually_monitor_domains
      end
    end

  private
    def block_user_domains(user, website, current_usage, limit)
      # Get domains to block (all domains with traffic in the last 24 hours)
      recent_domains = DomainRequestCount
        .joins(:domain)
        .where(user: user)
        .where('counted_at >= ?', 24.hours.ago)
        .group('domains.hostname')
        .sum(:request_count)
        .select { |_domain, count| count > 0 }
      
      return if recent_domains.empty?
      
      # Find or create firewall for this zone
      firewall = user.firewalls.find_or_create_by(
        zone_id: website.cloudflare_zone_id,
        zone_name: website.domain
      )
      
      # Prepare domains for blocking
      domains_to_block = recent_domains.map do |hostname, request_count|
        {
          domain: hostname,
          request_count: request_count,
          first_seen_at: 24.hours.ago,
          last_seen_at: Time.current,
          reason: "Plan limit exceeded: #{current_usage}/#{limit} requests"
        }
      end
      
      # Delegate to firewall model to handle blocking
      firewall.block_domains(domains_to_block)
      
      # Send notification to user
      PlanLimitExceededMailer.notify_user(user, current_usage, limit).deliver_later
    end
  end
end