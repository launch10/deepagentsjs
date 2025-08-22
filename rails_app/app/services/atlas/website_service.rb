# frozen_string_literal: true

module Atlas
  class WebsiteService < BaseService
    BASE_PATH = '/api/internal/websites'

    def list(limit: nil, user_id: nil)
      params = {}
      params[:limit] = limit if limit
      params[:userId] = user_id if user_id

      get(BASE_PATH, query: params)
    end

    def find(id)
      path = "#{BASE_PATH}/#{id}"
      get(path)
    end

    def find_by_url(url)
      path = "#{BASE_PATH}/by-url"
      params = { url: url }
      
      get(path, query: params)
    end

    def create(id:, user_id:, **attributes)
      params = {
        id: id,
        userId: user_id
      }.merge(format_params(attributes))

      post(BASE_PATH, body: params)
    end

    def update(id, **attributes)
      path = "#{BASE_PATH}/#{id}"
      put(path, body: attributes)
    end

    def destroy(id)
      path = "#{BASE_PATH}/#{id}"
      delete(path)
    end

    private

    def format_params(attributes)
      {}.tap do |params|
        params[:userId] = attributes[:user_id] if attributes[:user_id]
      end
    end
  end
end