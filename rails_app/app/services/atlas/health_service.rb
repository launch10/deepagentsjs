# frozen_string_literal: true

module Atlas
  class HealthService < BaseService
    def check
      with_logging(:get, '/api/internal/health') do
        make_request(:get, '/api/internal/health')
      end
    rescue => e
      { status: 'unhealthy', error: e.message }
    end

    def root_check
      with_logging(:get, '/') do
        make_request(:get, '/')
      end
    rescue => e
      { status: 'unhealthy', error: e.message }
    end
  end
end