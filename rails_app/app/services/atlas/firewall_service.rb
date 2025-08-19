# frozen_string_literal: true

module Atlas
  class FirewallService < BaseService
    # All firewall operations are through the tenant endpoints
    # This service provides a convenient interface for firewall management
    
    def block(tenant_id)
      tenant_service.block(tenant_id)
    end

    def unblock(tenant_id)
      tenant_service.unblock(tenant_id)
    end

    def reset(tenant_id)
      tenant_service.reset(tenant_id)
    end

    def status(tenant_id)
      tenant_service.status(tenant_id)
    end

    # Convenience method to check if a tenant is blocked
    def blocked?(tenant_id)
      response = status(tenant_id)
      response.dig('status') == 'blocked'
    rescue => e
      Rails.logger.error("Failed to check firewall status for tenant #{tenant_id}: #{e.message}")
      false
    end

    # Convenience method to check if a tenant is being monitored
    def monitoring?(tenant_id)
      response = status(tenant_id)
      response.dig('status') == 'monitoring'
    rescue => e
      Rails.logger.error("Failed to check firewall status for tenant #{tenant_id}: #{e.message}")
      false
    end

    private

    def tenant_service
      @tenant_service ||= TenantService.new
    end
  end
end