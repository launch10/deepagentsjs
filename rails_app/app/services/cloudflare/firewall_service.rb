class Cloudflare::FirewallService < ApplicationClient
  class ApiError < StandardError; end
  
  BASE_URI = 'https://api.cloudflare.com/client/v4'
  
  attr_reader :zone_id
  
  def initialize(zone_id)
    @zone_id = zone_id
    super(token: Cloudflare.config.api_token)
  end
  
  def create_rule(expression:, action: 'block', description: nil, priority: 1, enabled: true)
    payload = [
      {
        expression: expression,
        action: action,
        description: description,
        priority: priority,
        enabled: enabled
      }
    ]
    
    begin
      response = post("/zones/#{zone_id}/firewall/rules", payload)
      response
    rescue ApplicationClient::Error => e
      raise ApiError, e.message
    end
  end
  
  def delete_rule(rule_id)
    begin
      response = delete("/zones/#{zone_id}/firewall/rules/#{rule_id}")
      response
    rescue ApplicationClient::Error => e
      raise ApiError, e.message
    end
  end
  
  def list_rules(page: 1, per_page: 100, action: nil, fetch_all: false)
    params = { page: page, per_page: per_page }
    params[:action] = action if action
    
    begin
      if fetch_all
        all_rules = []
        current_page = 1
        
        loop do
          params[:page] = current_page
          response = get("/zones/#{zone_id}/firewall/rules", params: params)
          
          all_rules.concat(response['result']) if response['result']
          
          total_pages = response.dig('result_info', 'total_pages') || 1
          break if current_page >= total_pages
          
          current_page += 1
        end
        
        all_rules
      else
        response = get("/zones/#{zone_id}/firewall/rules", params: params)
        response['result'] || []
      end
    rescue ApplicationClient::Error => e
      raise ApiError, e.message
    end
  end
  
  def get_rule(rule_id)
    begin
      response = get("/zones/#{zone_id}/firewall/rules/#{rule_id}")
      response['result']
    rescue ApplicationClient::Error => e
      raise ApiError, e.message
    end
  end
  
  def update_rule(rule_id, updates)
    begin
      response = patch("/zones/#{zone_id}/firewall/rules/#{rule_id}", updates)
      response
    rescue ApplicationClient::Error => e
      raise ApiError, e.message
    end
  end
  
  def bulk_delete_rules(rule_ids)
    return { 'result' => [], 'success' => true } if rule_ids.empty?
    
    begin
      response = delete(
        "/zones/#{zone_id}/firewall/rules",
        params: { id: rule_ids.join(',') }
      )
      response
    rescue ApplicationClient::Error => e
      raise ApiError, e.message
    end
  end
  
  def validate_expression(expression)
    begin
      response = post(
        "/zones/#{zone_id}/firewall/rules/validate",
        { expression: expression }
      )
      response.dig('result', 'valid') == true
    rescue ApplicationClient::Error => e
      raise ApiError, e.message
    end
  end
  
  private
  
  def authorization_header
    if Cloudflare.config.api_token.present?
      { 'Authorization' => "Bearer #{token}" }
    elsif Cloudflare.config.api_email.present? && Cloudflare.config.api_key.present?
      {
        'X-Auth-Email' => Cloudflare.config.api_email,
        'X-Auth-Key' => Cloudflare.config.api_key
      }
    else
      {}
    end
  end
end