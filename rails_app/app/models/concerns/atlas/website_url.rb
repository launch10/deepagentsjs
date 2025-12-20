module Atlas
  module WebsiteUrl
    extend ActiveSupport::Concern
    include Atlas::Syncable

    def atlas_service
      Atlas.website_urls
    end

    private

    def atlas_data_for_create
      {
        id: atlas_identifier,
        domain: domain_string,
        path: path,
        website_id: website_id,
        domain_id: domain_id
      }
    end

    def atlas_data_for_update
      {
        id: atlas_identifier,
        domain: domain_string,
        path: path,
        website_id: website_id,
        domain_id: domain_id
      }
    end

    def sync_to_atlas_required?
      saved_change_to_path? || saved_change_to_website_id? || saved_change_to_domain_id?
    end

    def atlas_identifier
      id
    end
  end
end
