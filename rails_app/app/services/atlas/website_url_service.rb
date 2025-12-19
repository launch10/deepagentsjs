# frozen_string_literal: true

module Atlas
  class WebsiteUrlService < BaseService
    BASE_PATH = "/api/internal/website-urls"

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

    def find_by_domain_and_path(domain:, path: "/")
      query_path = "#{BASE_PATH}/by-domain-path"
      get(query_path, query: { domain: domain, path: path })
    end

    def create(id:, domain:, path:, website_id:, domain_id:, **attributes)
      params = {
        id: id,
        domain: domain,
        path: path,
        websiteId: website_id,
        domainId: domain_id
      }
      params.merge!(format_params(attributes))

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
        params[:path] = attributes[:path] if attributes[:path]
        params[:websiteId] = attributes[:website_id] if attributes[:website_id]
        params[:domainId] = attributes[:domain_id] if attributes[:domain_id]
      end
    end
  end
end
