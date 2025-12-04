# frozen_string_literal: true

module InertiaSchemas
  module Website
    def self.page_props
      {
        thread_id: InertiaSchemas.nullable(type: :string, description: 'Langgraph thread ID for the conversation'),
        project: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer },
            uuid: { type: :string, description: 'Project UUID' },
            name: { type: :string },
            account_id: { type: :integer }
          }
        ),
        chat: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer },
            thread_id: { type: :string }
          }
        ),
        workflow: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer },
            step: { type: :string, nullable: true },
            substep: { type: :string, nullable: true }
          }
        ),
        website: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer },
            name: { type: :string }
          }
        )
      }
    end

    def self.page_required
      %w[]
    end

    def self.props_schema
      InertiaSchemas.with_shared_props(
        page_props: page_props,
        page_required: page_required
      )
    end
  end
end
