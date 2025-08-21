# frozen_string_literal: true

module Atlas
  class WebsiteService < BaseService
    BASE_PATH = '/api/internal/websites'

    def list(limit: nil, user_id: nil)
      params = {}
      params[:limit] = limit if limit
      params[:userId] = user_id if user_id

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

    def find_by_url(url)
      path = "#{BASE_PATH}/by-url"
      params = { url: url }

      with_logging(:get, path, params) do
        make_request(:get, path, params)
      end
    end

    def create(id:, user_id:, **attributes)
      params = {
        id: id,
        userId: user_id
      }.merge(format_params(attributes))

      with_logging(:post, BASE_PATH, params) do
        make_request(:post, BASE_PATH, params)
      end
    end

    def update(id, **attributes)
      path = "#{BASE_PATH}/#{id}"
      
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

    private

    def format_params(attributes)
      {}.tap do |params|
        params[:userId] = attributes[:user_id] if attributes[:user_id]
      end
    end
  end
end