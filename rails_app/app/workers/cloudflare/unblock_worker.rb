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
  
  def perform(firewall_rule_id)
    rule = FirewallRule.find(firewall_rule_id)
    
    # Check if rule can be unblocked
    unless rule.status == 'blocked'
      raise FirewallRule::InvalidStateError, "Cannot unblock rule that is not blocked (status: #{rule.status})"
    end
    
    # If no Cloudflare rule ID, just mark as unblocked
    if rule.cloudflare_rule_id.blank?
      Rails.logger.warn("No Cloudflare rule ID found for FirewallRule #{rule.id}, marking as unblocked")
      rule.unblock!
      return
    end
    
    # Update status to unblocking
    rule.update!(status: 'unblocking')
    
    begin
      # Initialize Cloudflare service
      service = Cloudflare::FirewallService.new(rule.firewall.zone_id)
      
      # Delete the firewall rule
      response = service.delete_rule(rule.cloudflare_rule_id)
      
      if response['success'] || (response['errors']&.first&.dig('code') == 10008)
        # Success or rule not found (already deleted)
        if response['errors']&.first&.dig('code') == 10008
          Rails.logger.warn("Rule #{rule.cloudflare_rule_id} not found in Cloudflare, marking as unblocked anyway")
        end
        
        rule.unblock!
        
        # Update firewall status if no more blocked rules
        unless rule.firewall.firewall_rules.blocked.exists?
          rule.firewall.update!(has_blocked_domains: false)
        end
      else
        # Handle API error
        error_message = response['errors']&.first&.dig('message') || 'Unknown error'
        rule.mark_failed!(error_message)
        raise UnblockingError, error_message
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
      rules_to_unblock = []
      
      Rails.logger.info("Starting monthly unblock for user #{user.id}")
      
      # Get all blocked rules for the user
      user.firewalls.each do |firewall|
        rules_to_unblock += firewall.firewall_rules.blocked.to_a
        
        # Also retry failed unblock attempts
        rules_to_unblock += firewall.firewall_rules
          .failed
          .where.not(cloudflare_rule_id: nil)
          .needs_retry
          .each { |rule| rule.update!(status: 'unblocking') }
      end
      
      # Process rules with rate limiting
      rules_to_unblock.each_with_index do |rule, index|
        # Add delay for every 10 rules to avoid rate limiting
        delay = (index / 10) * 5
        
        if delay > 0
          Cloudflare::UnblockWorker.perform_in(delay.seconds, rule.id)
        else
          Cloudflare::UnblockWorker.perform_async(rule.id)
        end
      end
      
      Rails.logger.info("Queued #{rules_to_unblock.count} rules for unblocking for user #{user.id}")
      
      rules_to_unblock.count
    end
  end
  
  # Monthly job to unblock all users
  class MonthlyJob
    include Sidekiq::Worker
    
    sidekiq_options queue: :cloudflare_batch, retry: 3
    
    def perform
      Firewall.monthly_unblock_all
    end
  end
end