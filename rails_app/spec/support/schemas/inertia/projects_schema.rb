# frozen_string_literal: true

module InertiaSchemas
  module Projects
    def self.pagination_schema
      {
        type: :object,
        properties: {
          current_page: InertiaSchemas.integer_field,
          total_pages: InertiaSchemas.integer_field,
          total_count: InertiaSchemas.integer_field,
          prev_page: InertiaSchemas.nullable(type: :integer),
          next_page: InertiaSchemas.nullable(type: :integer),
          from: InertiaSchemas.nullable(type: :integer),
          to: InertiaSchemas.nullable(type: :integer),
          series: {
            type: :array,
            items: {
              oneOf: [
                {type: :integer},
                {type: :string}
              ]
            }
          }
        },
        required: %w[current_page total_pages total_count prev_page next_page series]
      }
    end

    def self.status_counts_schema
      {
        type: :object,
        properties: {
          draft: InertiaSchemas.integer_field,
          paused: InertiaSchemas.integer_field,
          live: InertiaSchemas.integer_field
        }
      }
    end

    def self.page_props
      {
        projects: {
          type: :array,
          items: InertiaSchemas.project_mini_schema
        },
        pagination: pagination_schema,
        status_counts: status_counts_schema
      }
    end

    def self.props_schema
      InertiaSchemas.with_shared_props(
        page_props: page_props,
        page_required: %w[projects pagination status_counts]
      )
    end
  end
end
