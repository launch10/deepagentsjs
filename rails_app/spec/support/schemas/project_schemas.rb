# frozen_string_literal: true

module APISchemas
  module Project
    # Mini project response (for list items)
    def self.mini_response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          uuid: APISchemas.uuid_field,
          website_id: {type: [:integer, :null], description: "Associated website ID"},
          account_id: APISchemas.id_field,
          name: {type: :string, description: "Project name"},
          status: {type: :string, enum: %w[draft paused live], description: "Project status"},
          domain: {type: [:string, :null], description: "Primary domain"},
          created_at: APISchemas.timestamp_field,
          updated_at: APISchemas.timestamp_field
        },
        required: %w[id uuid account_id name status created_at updated_at]
      }
    end

    # Pagination metadata
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

    # Status counts for filter badges
    def self.status_counts_response
      {
        type: :object,
        properties: {
          draft: {type: :integer, description: "Number of draft projects"},
          paused: {type: :integer, description: "Number of paused projects"},
          live: {type: :integer, description: "Number of live projects"}
        }
      }
    end

    # Paginated project list response
    def self.list_response
      {
        type: :object,
        properties: {
          projects: {type: :array, items: mini_response},
          pagination: pagination_response,
          status_counts: status_counts_response
        },
        required: %w[projects pagination status_counts]
      }
    end
  end
end
