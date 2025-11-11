# frozen_string_literal: true

module ApiSchemas
  module Brainstorm
    # Brainstorm response schema
    def self.response
      {
        type: :object,
        properties: {
          id: ApiSchemas.id_field,
          website_id: ApiSchemas.id_field,
          project_id: ApiSchemas.id_field,
          name: {type: :string, description: 'Brainstorm name'},
          thread_id: ApiSchemas.uuid_field,
          account_id: ApiSchemas.id_field,
          **ApiSchemas.timestamps
        },
        required: ['id', 'thread_id', 'account_id']
      }
    end

    # Brainstorm create/update params schema
    def self.params_schema
      {
        type: :object,
        properties: {
          brainstorm: {
            type: :object,
            properties: {
              name: {
                type: :string,
                description: 'Optional name for the brainstorm. Defaults to MM/DD/YYYY HH:MM:SS'
              },
              thread_id: {
                type: :string,
                description: 'Required thread ID from Langgraph'
              },
              idea: {
                type: :string,
                description: 'The core idea for the landing page'
              },
              audience: {
                type: :string,
                description: 'Target audience for the landing page'
              },
              solution: {
                type: :string,
                description: 'The solution being offered'
              },
              social_proof: {
                type: :string,
                description: 'Social proof elements'
              },
              look_and_feel: {
                type: :string,
                description: 'Design preferences'
              }
            }
          }
        },
        required: ['brainstorm']
      }
    end
  end
end
