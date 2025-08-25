# frozen_string_literal: true

module Atlas
  class HealthService < BaseService
    def check
      get('/api/internal/health')
    rescue => e
      { status: 'unhealthy', error: e.message }
    end

    def root_check
      get('/')
    rescue => e
      { status: 'unhealthy', error: e.message }
    end
  end
end