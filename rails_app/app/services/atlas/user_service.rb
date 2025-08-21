# frozen_string_literal: true

module Atlas
  class UserService < BaseService
    BASE_PATH = '/api/internal/users'

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

    def create(id:, org_id:, plan_id:, **attributes)
      params = {
        id: id,
        orgId: org_id,
        planId: plan_id
      }.merge(attributes)

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

    # Firewall management methods
    def block(id)
      path = "#{BASE_PATH}/#{id}/block"
      
      with_logging(:post, path) do
        make_request(:post, path)
      end
    end

    def unblock(id)
      path = "#{BASE_PATH}/#{id}/unblock"
      
      with_logging(:post, path) do
        make_request(:post, path)
      end
    end

    def reset(id)
      path = "#{BASE_PATH}/#{id}/reset"
      
      with_logging(:post, path) do
        make_request(:post, path)
      end
    end

    def status(id)
      path = "#{BASE_PATH}/#{id}/status"
      
      with_logging(:get, path) do
        make_request(:get, path)
      end
    end
  end
end