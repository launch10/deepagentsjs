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
  
  class BatchWorker
    include Sidekiq::Worker
    
    sidekiq_options queue: :cloudflare_batch, retry: 3
    
    def perform(user_id)
      user = User.find(user_id)
      rules_to_process = []
      
      # Get all pending rules for the user
      user.firewalls.each do |firewall|
        rules_to_process += firewall.firewall_rules.pending.to_a
        
        # Also retry failed rules that are eligible
        rules_to_process += firewall.firewall_rules.needs_retry.each do |rule|
          rule.update!(status: 'blocking')
        end
      end
      
      # Process rules with rate limiting
      rules_to_process.each_with_index do |rule, index|
        # Add delay for every 10 rules to avoid rate limiting
        delay = (index / 10) * 5
        
        if delay > 0
          Cloudflare::BlockWorker.perform_in(delay.seconds, rule.id)
        else
          Cloudflare::BlockWorker.perform_async(rule.id)
        end
      end
      
      rules_to_process.count
    end
  end
end