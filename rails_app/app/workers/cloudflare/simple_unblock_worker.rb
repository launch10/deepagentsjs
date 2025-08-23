class Cloudflare
  class SimpleUnblockWorker
    include Sidekiq::Worker
    
    sidekiq_options queue: :cloudflare, retry: 3
    
    def perform(user_id, zone_id)
      user = User.find_by(id: user_id)
      return unless user
      
      # Check if we should unblock
      firewall = Cloudflare::Firewall.find_by(user: user, cloudflare_zone_id: zone_id)
      return unless firewall
      
      # Don't unblock if blocked in the current month
      if firewall.blocked_at && firewall.blocked_at.beginning_of_month == Time.current.beginning_of_month
        Rails.logger.info "Not unblocking user #{user_id} - still in the same month as when blocked"
        return
      end
      
      # Check if user is still over limit for current month
      current_month_count = UserRequestCount.find_by(
        user: user,
        month: Time.current.beginning_of_month
      )
      
      if current_month_count&.over_limit?
        Rails.logger.info "Not unblocking user #{user_id} - still over limit for current month"
        return
      end
      
      # Unblock the user using FirewallService
      service = Cloudflare::FirewallService.new
      service.unblock_user(user: user, zone_id: zone_id)
      
      # Update firewall record
      firewall.update!(status: 'inactive', blocked_at: nil)
      
      Rails.logger.info "Unblocked user #{user_id} for zone #{zone_id}"
    end
  end
end