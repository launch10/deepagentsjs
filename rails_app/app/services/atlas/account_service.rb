# frozen_string_literal: true

module Atlas
  class AccountService < BaseService
    BASE_PATH = "/api/internal/accounts"

    def list(limit: nil)
      params = {}
      params[:limit] = limit if limit

      get(BASE_PATH, query: params)
    end

    def find(id)
      path = "#{BASE_PATH}/#{id}"
      get(path)
    end

    def create(id:, plan_id: nil, **attributes)
      params = {
        id: id,
        planId: plan_id
      }.compact.merge(attributes)

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

    # Firewall management methods
    def block(id)
      path = "#{BASE_PATH}/#{id}/block"
      post(path)
    end

    def unblock(id)
      path = "#{BASE_PATH}/#{id}/unblock"
      post(path)
    end

    def reset(id)
      path = "#{BASE_PATH}/#{id}/reset"
      post(path)
    end

    def status(id)
      path = "#{BASE_PATH}/#{id}/status"
      get(path)
    end
  end
end
