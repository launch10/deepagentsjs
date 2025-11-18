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
        account_id: account.id
      }
    end

    def atlas_data_for_update
      {
        account_id: account.id
      }
    end

    def sync_to_atlas_required?
      # Only sync if user_id changes (unlikely but possible)
      saved_change_to_account_id?
    end

    def atlas_identifier
      id
    end
  end
end
