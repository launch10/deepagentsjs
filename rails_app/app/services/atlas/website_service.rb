# frozen_string_literal: true

module Atlas
  class WebsiteService < BaseService
    BASE_PATH = '/api/internal/websites'

    def list(limit: nil, account_id: nil)
      params = {}
      params[:limit] = limit if limit
      params[:accountId] = account_id if account_id

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

    def create(id:, account_id:, **attributes)
      params = {
        id: id,
        accountId: account_id
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
        params[:accountId] = attributes[:account_id] if attributes[:account_id]
      end
    end
  end
end