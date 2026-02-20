# frozen_string_literal: true

module InertiaSchemas
  module Leads
    def self.lead_schema
      {
        type: :object,
        properties: {
          id: InertiaSchemas.integer_field,
          name: InertiaSchemas.nullable(type: :string),
          email: InertiaSchemas.string_field,
          phone: InertiaSchemas.nullable(type: :string),
          date: InertiaSchemas.string_field
        },
        required: %w[id email date]
      }
    end

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
                { type: :integer },
                { type: :string } # Can be page number as string or "gap"
              ]
            }
          }
        },
        required: %w[current_page total_pages total_count prev_page next_page series]
      }
    end

    def self.page_props
      {
        project: InertiaSchemas.project_mini_schema,
        leads: {
          type: :array,
          items: lead_schema
        },
        pagination: pagination_schema
      }
    end

    def self.props_schema
      InertiaSchemas.with_shared_props(
        page_props: page_props,
        page_required: %w[project leads pagination]
      )
    end
  end
end
