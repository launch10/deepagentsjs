class Cloudflare::FirewallService < ApplicationClient
  class APIError < StandardError; end

  BASE_URI = "https://api.cloudflare.com/client/v4"

  def initialize
    super(token: Cloudflare.config.api_token)
  end

  def endpoint
    "/accounts/#{Cloudflare.config.account_id}/rules/lists/#{Cloudflare.config.blocked_domains_list_id}/items"
  end

  def block_domains(domains)
    domains = domains.is_a?(Array) ? domains : [domains]
    validate_domains(domains)

    # Return early if no domains to block
    if domains.empty?
      Rails.logger.info "[FirewallService] No domains to block, skipping API call"
      return OpenStruct.new(success?: true, parsed_body: {result: []})
    end

    body = domains.map do |domain|
      {
        hostname: {url_hostname: domain.domain},
        comment: "Auto-suspended by worker on #{Time.now}"
      }
    end

    begin
      post(endpoint, body: body)
    rescue ApplicationClient::Error => e
      raise APIError, e.message
    end
  end

  def unblock_domains(cloudflare_rule_ids)
    unless cloudflare_rule_ids.is_a?(Array)
      raise ArgumentError, "cloudflare_rule_ids must be an array of IDs"
    end

    body = {
      items: cloudflare_rule_ids.map do |id|
        {id: id}
      end
    }

    begin
      delete(endpoint, body: body)
    rescue ApplicationClient::Error => e
      raise APIError, e.message
    end
  end

  def search_blocked_domains(domains)
    return {} if domains.empty?

    begin
      domains.map do |domain|
        get(endpoint, query: {search: domain.domain})
      end.each_with_object({}) do |response, acc|
        return acc unless response.success?

        body = response.parsed_body
        acc[body.dig(:result, 0, :hostname, :url_hostname)] = body.dig(:result, 0, :id)
      end
    rescue ApplicationClient::Error => e
      raise APIError, e.message
    end
  end

  def block_account(user:, zone_id:, reason: nil)
    # Block user by creating firewall rules for their domains
    Rails.logger.info "Blocking user #{user.id} on zone #{zone_id}: #{reason}"

    # Get user's domains for this zone
    domains = user.domains.where(zone_id: zone_id)
    return if domains.empty?

    # Block the domains
    block_domains(domains)

    # Create or update firewall record
    firewall = Cloudflare::Firewall.find_or_create_by(user: user, cloudflare_zone_id: zone_id)
    firewall.update!(status: "blocked", blocked_at: Time.current)

    true
  end

  def unblock_account(user:, zone_id:)
    # Unblock user by removing firewall rules for their domains
    Rails.logger.info "Unblocking user #{user.id} on zone #{zone_id}"

    # Get user's domains for this zone
    domains = user.domains.where(zone_id: zone_id)
    return if domains.empty?

    # Unblock the domains
    unblock_domains(domains)

    # Update firewall record
    firewall = Cloudflare::Firewall.find_by(user: user, cloudflare_zone_id: zone_id)
    firewall&.update!(status: "inactive", blocked_at: nil)

    true
  end

  private

  def validate_domains(domains)
    raise ArgumentError, "Domains must be an array of Domain objects" unless domains.is_a?(Array) && domains.all? { |d| d.is_a?(Domain) }
  end

  def authorization_header
    {
      "Authorization" => "Bearer #{Cloudflare.config.api_token}",
      "X-Auth-Email" => Cloudflare.config.email,
      "Content-Type" => "application/json"
    }
  end
end
