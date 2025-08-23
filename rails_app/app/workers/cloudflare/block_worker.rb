class Cloudflare::BlockWorker
  include Sidekiq::Worker
  
  class BlockingError < StandardError; end
  
  sidekiq_options queue: :cloudflare, retry: 5
  
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
    domains = user.firewall_rules.inactive.map(&:domain).map(&:domain)
  end
  
  class BlockRuleWorker
    include Sidekiq::Worker
    
    sidekiq_options queue: :cloudflare, retry: 5
    
    def perform(firewall_rule_id)
      rule = FirewallRule.find(firewall_rule_id)
      
      # Skip if already blocked
      return if rule.status == 'blocked' && rule.cloudflare_rule_id.present?
      
      # Update status to blocking
      rule.update!(status: 'blocking')
      
      begin
        # Initialize Cloudflare service
        service = Cloudflare::FirewallService.new(rule.firewall.zone_id)
        
        # Create the firewall rule
        response = service.create_rule(
          expression: rule.build_cloudflare_expression,
          action: 'block',
          description: "Auto-blocked: #{rule.domain}"
        )
        
        if response['success']
          # Mark as successfully blocked
          rule.block!(response['result']['id'])
        else
          # Handle API error
          error_message = response['errors']&.first&.dig('message') || 'Unknown error'
          rule.mark_failed!(error_message)
          raise BlockingError, error_message
        end
      rescue Cloudflare::FirewallService::ApiError => e
        rule.mark_failed!(e.message)
        raise e
      rescue StandardError => e
        rule.mark_failed!(e.message)
        raise e
      end
    end
  end
end