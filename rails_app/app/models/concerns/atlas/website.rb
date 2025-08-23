module Atlas
  module Website
    extend ActiveSupport::Concern
    include Atlas::Syncable

    def atlas_service
      Atlas.websites
    end
  private

    def atlas_data_for_create
      {
        id: id,
        user_id: user.id
      }
    end

    def atlas_data_for_update
      {
        user_id: user.id
      }
    end

    def sync_to_atlas_required?
      # Only sync if user_id changes (unlikely but possible)
      saved_change_to_user_id?
    end

    def atlas_identifier
      id
    end
  end
end