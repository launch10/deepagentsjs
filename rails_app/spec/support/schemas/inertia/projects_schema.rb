# frozen_string_literal: true

module InertiaSchemas
  module Projects
    def self.project_card_schema
      {
        type: :object,
        properties: {
          id: InertiaSchemas.integer_field,
          uuid: InertiaSchemas.string_field,
          website_id: InertiaSchemas.nullable(type: :integer),
          account_id: InertiaSchemas.integer_field,
          name: InertiaSchemas.string_field,
          status: { type: :string, enum: %w[live paused draft] },
          domain: InertiaSchemas.nullable(type: :string),
          created_at: {}, # Any type (Time object serializes as various formats)
          updated_at: {}  # Any type (Time object serializes as various formats)
        },
        required: %w[id uuid account_id name status]
      }
    end

    def self.page_props
      {
        projects: {
          type: :array,
          items: project_card_schema
        },
        total_count: InertiaSchemas.integer_field
      }
    end

    def self.props_schema
      InertiaSchemas.with_shared_props(
        page_props: page_props,
        page_required: %w[projects total_count]
      )
    end
  end
end
