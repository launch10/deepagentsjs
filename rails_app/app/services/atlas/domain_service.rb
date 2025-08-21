# frozen_string_literal: true

module Atlas
  class DomainService < BaseService
    BASE_PATH = '/api/internal/domains'

    def list(limit: nil, website_id: nil)
      params = {}
      params[:limit] = limit if limit
      params[:websiteId] = website_id if website_id

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

    def create(domain:, website_id:, **attributes)
      params = {
        domain: domain,
        websiteId: website_id
      }.merge(format_params(attributes))

      with_logging(:post, BASE_PATH, params) do
        make_request(:post, BASE_PATH, params)
      end
    end

    def update(id, **attributes)
      path = "#{BASE_PATH}/#{id}"
      formatted_params = format_params(attributes)
      
      with_logging(:put, path, formatted_params) do
        make_request(:put, path, formatted_params)
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
        params[:domain] = attributes[:domain] if attributes[:domain]
        params[:websiteId] = attributes[:website_id] if attributes[:website_id]
      end
    end
  end
end