class Cloudflare::FirewallService < ApplicationClient
  class ApiError < StandardError; end
  
  ENDPOINT = "https://api.cloudflare.com/client/v4/accounts/#{Cloudflare.config.account_id}/rules/lists/#{Cloudflare.config.blocked_domains_list_id}/items"
  
  def initialize
    super(token: Cloudflare.config.api_token)
  end

  def block_domains(domains)
    validate_domains(domains)
    
    body = domains.map do |domain|
      {
        hostname: { url_hostname: domain.domain },
        comment: "Auto-suspended by worker on #{Time.now.to_s}"
      }
    end
    
    begin
      response = post(ENDPOINT, body)
      response
    rescue ApplicationClient::Error => e
      raise ApiError, e.message
    end
  end

  def unblock_domains(domains)
    validate_domains(domains)
    
    body = {
      items: domains.map do |domain|
        { id: domain.cloudflare_rule_id }
      end
    }
    
    begin
      response = delete(ENDPOINT, body)
      response
    rescue ApplicationClient::Error => e
      raise ApiError, e.message
    end
  end

  def list_blocked_domains
    begin
      response = get(ENDPOINT)
      response
    rescue ApplicationClient::Error => e
      raise ApiError, e.message
    end
  end
  
  def block_user(user:, zone_id:, reason: nil)
    # Block user by creating firewall rules for their domains
    Rails.logger.info "Blocking user #{user.id} on zone #{zone_id}: #{reason}"
    
    # Get user's domains for this zone
    domains = user.domains.where(zone_id: zone_id)
    return if domains.empty?
    
    # Block the domains
    block_domains(domains)
    
    # Create or update firewall record
    firewall = Cloudflare::Firewall.find_or_create_by(user: user, cloudflare_zone_id: zone_id)
    firewall.update!(status: 'blocked', blocked_at: Time.current)
    
    true
  end
  
  def unblock_user(user:, zone_id:)
    # Unblock user by removing firewall rules for their domains
    Rails.logger.info "Unblocking user #{user.id} on zone #{zone_id}"
    
    # Get user's domains for this zone
    domains = user.domains.where(zone_id: zone_id)
    return if domains.empty?
    
    # Unblock the domains
    unblock_domains(domains)
    
    # Update firewall record
    firewall = Cloudflare::Firewall.find_by(user: user, cloudflare_zone_id: zone_id)
    firewall&.update!(status: 'inactive', blocked_at: nil)
    
    true
  end
  
  private

  def validate_domains(domains)
    raise ArgumentError, "Domains must be an array of Domain objects" unless domains.is_a?(Array) && domains.all? { |d| d.is_a?(Domain) }
  end
  
  def authorization_header
    { 
      'Authorization' => "Bearer #{Cloudflare.config.api_token}",
      'Content-Type' => 'application/json'
    }
  end
end