# frozen_string_literal: true

module Atlas
  class DomainService < BaseService
    BASE_PATH = "/api/internal/domains"

    def list(limit: nil, website_id: nil)
      params = {}
      params[:limit] = limit if limit
      params[:websiteId] = website_id if website_id

      get(BASE_PATH, query: params)
    end

    def find(id)
      path = "#{BASE_PATH}/#{id}"
      get(path)
    end

    def create(id:, domain:, website_id:, **attributes)
      params = {
        id: id,
        domain: domain,
        websiteId: website_id
      }.merge(format_params(attributes))

      post(BASE_PATH, body: params)
    end

    def update(id, **attributes)
      path = "#{BASE_PATH}/#{id}"
      formatted_params = format_params(attributes)
      put(path, body: formatted_params)
    end

    def destroy(id)
      path = "#{BASE_PATH}/#{id}"
      delete(path)
    end

    private

    def format_params(attributes)
      {}.tap do |params|
        params[:domain] = attributes[:domain] if attributes[:domain]
        params[:websiteId] = attributes[:website_id] if attributes[:website_id]
      end
    end
  end
end
