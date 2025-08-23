module Atlas
  module Domain
    extend ActiveSupport::Concern

    included do
      include Atlas::Syncable
    end

  private
    # Atlas sync methods
    def atlas_service
      Atlas.domains
    end

    def atlas_data_for_create
      {
        id: atlas_identifier,
        domain: domain,
        website_id: website_id
      }
    end

    def atlas_data_for_update
      {
        id: atlas_identifier,
        domain: domain,
        website_id: website_id
      }
    end

    def sync_to_atlas_required?
      # Sync if domain or website_id changes
      saved_change_to_domain? || saved_change_to_website_id?
    end

    def atlas_identifier
      id
    end
  end
end