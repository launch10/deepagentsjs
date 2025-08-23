class Cloudflare::TrafficWorker
  include Sidekiq::Worker
  
  sidekiq_options queue: :cloudflare, retry: 5

  def perform(options = {})
    zone_id = options["zone_id"] || options[:zone_id]
    start_time = EST.now.beginning_of_hour
    end_time = EST.now.end_of_hour

    # Find the website/domain associated with this zone_id
    website = Website.find_by(cloudflare_zone_id: zone_id)
    return log_missing_website(zone_id) unless website
    
    user = website.user
    
    # Exit early if user is already blocked for this month
    return if user_already_blocked?(user)

    # sample report: {"abeverything.com" => 16, "example.abeverything.com" => 50}
    traffic_report = Cloudflare::Analytics::Queries::TrafficQueries.new.hourly_traffic_by_host(
      zone_id: zone_id,
      start_time: start_time,
      end_time: end_time
    )

    return if traffic_report.blank?

    # Process traffic data and store domain request counts
    domain_counts = process_traffic_report(traffic_report, website, user, start_time)
    
    # Update user's monthly request count
    update_user_request_count(user, domain_counts, start_time)
    
    # Check if user has exceeded their plan limits
    check_and_enforce_limits(user, website)
  end
  
  private
  
  def user_already_blocked?(user)
    user.firewalls.joins(:firewall_rules).where(firewall_rules: { status: 'blocked' }).exists?
  end
  
  def log_missing_website(zone_id)
    Rails.logger.warn("No website found for Cloudflare zone_id: #{zone_id}")
  end
  
  def update_user_request_count(user, request_count, start_time)
    month_start = start_time.beginning_of_month
    
    user_request_count = UserRequestCount.find_or_initialize_by(
      user: user,
      month: month_start
    )
    
    # Add this hour's requests to the monthly total
    user_request_count.request_count ||= 0
    user_request_count.request_count += request_count
    user_request_count.last_updated_at = Time.current
    user_request_count.save!
  end
  
  def check_and_enforce_limits(user, website)
    # Get user's current plan limit
    plan_limit = user.account.plan&.plan_limits&.find_by(limit_type: 'requests_per_month')
    return unless plan_limit
    
    # Get current month's usage
    current_month = EST.now.beginning_of_month
    user_request_count = user.user_request_counts.find_by(month: current_month)
    return unless user_request_count
    
    # Check if limit exceeded
    if user_request_count.request_count > plan_limit.limit
      block_user_domains(user, website, user_request_count.request_count, plan_limit.limit)
    end
  end
  
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

  class BatchWorker
    include Sidekiq::Worker
    
    sidekiq_options queue: :cloudflare_batch, retry: 3
    def perform(batch_options = {})
      Cloudflare::Analytics::Queries::TrafficQueries.new.get_all_zones do |zones|
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
  end
end