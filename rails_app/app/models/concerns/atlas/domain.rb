module Atlas
  module Domain
    extend ActiveSupport::Concern
    include Atlas::Syncable

    def atlas_service
      Atlas.domains
    end

    private

    def atlas_data_for_create
      {
        id: atlas_identifier,
        domain: domain
      }
    end

    def atlas_data_for_update
      {
        id: atlas_identifier,
        domain: domain
      }
    end

    def sync_to_atlas_required?
      # Sync if domain changes
      saved_change_to_domain?
    end

    def atlas_identifier
      id
    end
  end
end
