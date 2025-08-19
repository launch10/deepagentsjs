# frozen_string_literal: true

module Atlas
  class << self
    def tenants
      @tenants ||= TenantService.new
    end

    def sites
      @sites ||= SiteService.new
    end

    def plans
      @plans ||= PlanService.new
    end

    def deployments
      @deployments ||= DeploymentService.new
    end

    def health
      @health ||= HealthService.new
    end

    def firewall
      @firewall ||= FirewallService.new
    end

    # Convenience method for deployment
    def deploy(site_id:, files: nil, config: nil)
      deployments.deploy(site_id: site_id, files: files, config: config)
    end

    # Reset all service instances (useful for testing)
    def reset!
      @tenants = nil
      @sites = nil
      @plans = nil
      @deployments = nil
      @health = nil
      @firewall = nil
    end

    # Configure all services at once
    def configure
      yield BaseService.config
    end

    def config
      BaseService.config
    end
  end
end