# frozen_string_literal: true

module Atlas
  class PlanService < BaseService
    BASE_PATH = "/api/internal/plans"

    def list(limit: nil)
      params = {}
      params[:limit] = limit if limit

      get(BASE_PATH, query: params)
    end

    def find(id)
      path = "#{BASE_PATH}/#{id}"
      get(path)
    end

    def create(plan_data)
      params = format_plan_params(plan_data)
      post(BASE_PATH, body: params)
    end

    def update(id, plan_data)
      path = "#{BASE_PATH}/#{id}"
      params = format_plan_params(plan_data)
      put(path, body: params)
    end

    def destroy(id)
      path = "#{BASE_PATH}/#{id}"
      delete(path)
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
