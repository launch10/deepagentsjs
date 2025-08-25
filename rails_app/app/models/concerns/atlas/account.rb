module Atlas
  module Account
    extend ActiveSupport::Concern
    include Atlas::Syncable

private
    def atlas_service
      Atlas.accounts
    end

    def atlas_data_for_create
      {
        id: id,
        plan_id: current_plan_id
      }.compact
    end

    def atlas_data_for_update
      {
        plan_id: current_plan_id
      }.compact
    end

    def sync_to_atlas_required?
      # Atlas doesn't track account changes, only plan changes
      # This will be triggered by subscription callbacks
      false
    end
  end
end