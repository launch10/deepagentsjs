# frozen_string_literal: true

module Atlas
  class PlanService < BaseService
    BASE_PATH = '/api/internal/plans'

    def list(limit: nil)
      params = {}
      params[:limit] = limit if limit

      with_logging(:get, BASE_PATH, params) do
        make_request(:get, BASE_PATH, params)
      end
    end

    def find(id)
      path = "#{BASE_PATH}/#{id}"
      
      with_logging(:get, path) do
        make_request(:get, path)
      end
    end

    def create(plan_data)
      params = format_plan_params(plan_data)

      with_logging(:post, BASE_PATH, params) do
        make_request(:post, BASE_PATH, params)
      end
    end

    def update(id, plan_data)
      path = "#{BASE_PATH}/#{id}"
      params = format_plan_params(plan_data)
      
      with_logging(:put, path, params) do
        make_request(:put, path, params)
      end
    end

    def destroy(id)
      path = "#{BASE_PATH}/#{id}"
      
      with_logging(:delete, path) do
        make_request(:delete, path)
      end
    end

    private

    def format_plan_params(data)
      {}.tap do |params|
        params[:id] = data[:id] if data[:id]
        params[:name] = data[:name] if data[:name]
        params[:usageLimit] = data[:usage_limit] if data[:usage_limit]
      end
    end
  end
end