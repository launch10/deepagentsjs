# frozen_string_literal: true

module APISchemas
  module WebsiteDeploy
    def self.response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          status: {type: :string, description: "Deploy status (pending, building, uploading, completed, failed, skipped)"},
          environment: {type: :string, description: "Deploy environment (development, staging, production)"},
          is_live: {type: :boolean, description: "Whether this deploy is currently live"},
          is_preview: {type: :boolean, description: "Whether this is a preview deploy"},
          revertible: {type: :boolean, description: "Whether this deploy can be rolled back to"},
          created_at: APISchemas.timestamp_field
        },
        required: %w[id status environment is_live revertible created_at]
      }
    end

    def self.list_response
      {
        type: :array,
        items: response
      }
    end

    def self.rollback_response
      {
        type: :object,
        properties: {
          success: {type: :boolean}
        },
        required: %w[success]
      }
    end
  end
end
