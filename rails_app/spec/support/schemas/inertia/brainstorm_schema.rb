# frozen_string_literal: true

module InertiaSchemas
  module NewBrainstorm
    def self.page_props
      {
        thread_id: InertiaSchemas.always_null(description: 'Langgraph thread ID for the conversation'),
        project: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            uuid: InertiaSchemas.always_null(description: 'Project UUID')
          }
        )
      }
    end

    def self.page_required
      %w[thread_id]
    end

    def self.props_schema
      InertiaSchemas.with_shared_props(
        page_props: page_props,
        page_required: page_required
      )
    end
  end

  module Brainstorm
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
        brainstorm: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer },
            name: { type: :string },
            idea: { type: :string, nullable: true },
            audience: { type: :string, nullable: true },
            solution: { type: :string, nullable: true },
            social_proof: { type: :string, nullable: true },
            look_and_feel: { type: :string, nullable: true },
            thread_id: { type: :string }
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
      %w[thread_id]
    end

    def self.props_schema
      InertiaSchemas.with_shared_props(
        page_props: page_props,
        page_required: page_required
      )
    end
  end
end
