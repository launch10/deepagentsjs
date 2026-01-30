# frozen_string_literal: true

module InertiaSchemas
  module Projects
    def self.page_props
      {
        projects: {
          type: :array,
          items: InertiaSchemas.project_mini_schema
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
