class Cloudflare::UnblockWorker
  include Sidekiq::Worker
  
  class UnblockingError < StandardError; end
  
  sidekiq_options queue: :critical, retry: 5
  
  sidekiq_retry_in do |count, exception|
    # Exponential backoff: 1min, 5min, 15min, 1hr, 2hr
    [60, 300, 900, 3600, 7200][count - 1] || 7200
  end
  
  sidekiq_retries_exhausted do |msg, ex|
    rule_id = msg['args'].first
    rule = FirewallRule.find_by(id: rule_id)
    
    if rule
      rule.mark_failed!("Maximum retries exceeded after 5 attempts - manual intervention required")
      
      Rollbar.error('Cloudflare unblocking failed after max retries', {
        firewall_rule_id: rule.id,
        domain: rule.domain,
        cloudflare_rule_id: rule.cloudflare_rule_id,
        error: msg['error_message']
      })
      
      # Notify admin for manual intervention
      if defined?(AdminMailer)
        AdminMailer.unblock_failure_needs_intervention(rule).deliver_later
      end
    end
  end
  
  def perform(options = {})
    options = options.symbolize_keys
    user = User.find(options[:user_id])
    force = options[:force] || false
    Cloudflare::Firewall.actually_unblock_user(user, force: force)
  end
end