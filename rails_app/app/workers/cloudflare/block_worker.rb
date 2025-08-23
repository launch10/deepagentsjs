class Cloudflare::BlockWorker
  include Sidekiq::Worker
  
  class BlockingError < StandardError; end
  
  sidekiq_options queue: :critical, retry: 5
  
  sidekiq_retry_in do |count, exception|
    # Exponential backoff: 1min, 5min, 15min, 1hr, 2hr
    [60, 300, 900, 3600, 7200][count - 1] || 7200
  end
  
  sidekiq_retries_exhausted do |msg, ex|
    rule_id = msg['args'].first
    rule = FirewallRule.find_by(id: rule_id)
    
    if rule
      rule.mark_failed!("Maximum retries exceeded after 5 attempts")
      
      Rollbar.error('Cloudflare blocking failed after max retries', {
        firewall_rule_id: rule.id,
        domain: rule.domain,
        error: msg['error_message']
      })
      
      # Notify user if configured
      if defined?(BlockingFailureMailer)
        BlockingFailureMailer.max_retries_exceeded(rule).deliver_later
      end
    end
  end

  def perform(options = {})
    options = options.symbolize_keys
    user = User.find(options[:user_id])
    binding.pry
    firewall = user.firewall || user.create_firewall
    domains = user.firewall_rules.inactive.map(&:domain)
    response = Cloudflare::FirewallService.new(user.firewall.zone_id).block_domains(domains)
    # get cloudflare ids and update domains
  end
end