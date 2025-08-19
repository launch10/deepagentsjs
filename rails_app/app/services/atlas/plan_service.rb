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

    def create(id:, name:, usage_limit:, **attributes)
      params = {
        id: id,
        name: name,
        usageLimit: usage_limit
      }.merge(attributes)

      with_logging(:post, BASE_PATH, params) do
        make_request(:post, BASE_PATH, params)
      end
    end

    def update(id, **attributes)
      path = "#{BASE_PATH}/#{id}"
      
      # Convert snake_case to camelCase for the API
      if attributes[:usage_limit]
        attributes[:usageLimit] = attributes.delete(:usage_limit)
      end
      
      with_logging(:put, path, attributes) do
        make_request(:put, path, attributes)
      end
    end

    def destroy(id)
      path = "#{BASE_PATH}/#{id}"
      
      with_logging(:delete, path) do
        make_request(:delete, path)
      end
    end
  end
end