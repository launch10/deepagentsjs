module Atlas
  module Plan
    extend ActiveSupport::Concern
    include Atlas::Syncable

    def atlas_service
      Atlas.plans
    end

    private

    def atlas_data_for_create
      {
        id: id,
        name: name,
        usage_limit: monthly_request_limit
      }
    end

    def atlas_data_for_update
      {
        name: name,
        usage_limit: monthly_request_limit
      }
    end

    def sync_to_atlas_required?
      plan_limits.any?(&:saved_changes?)
    end
  end
end
