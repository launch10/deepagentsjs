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

    def self.pagination_response
      {
        type: :object,
        properties: {
          current_page: {type: :integer, description: "Current page number"},
          total_pages: {type: :integer, description: "Total number of pages"},
          total_count: {type: :integer, description: "Total number of items"},
          prev_page: {type: [:integer, :null], description: "Previous page number or null"},
          next_page: {type: [:integer, :null], description: "Next page number or null"},
          from: {type: [:integer, :null], description: "First item index on current page"},
          to: {type: [:integer, :null], description: "Last item index on current page"},
          series: {
            type: :array,
            items: {oneOf: [{type: :integer}, {type: :string}]},
            description: "Page series for pagination controls"
          }
        },
        required: %w[current_page total_pages total_count]
      }
    end

    def self.paginated_list_response
      {
        type: :object,
        properties: {
          website_deploys: {type: :array, items: response},
          pagination: pagination_response
        },
        required: %w[website_deploys pagination]
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
