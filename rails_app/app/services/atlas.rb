# frozen_string_literal: true

module Atlas
  class << self
    def users
      @users ||= UserService.new
    end

    def websites
      @websites ||= WebsiteService.new
    end

    def plans
      @plans ||= PlanService.new
    end

    def health
      @health ||= HealthService.new
    end

    # Reset all service instances (useful for testing)
    def reset!
      @users = nil
      @websites = nil
      @plans = nil
      @health = nil
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