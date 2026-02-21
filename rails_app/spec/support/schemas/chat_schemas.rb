# frozen_string_literal: true

module APISchemas
  module Chat
    # Chat response schema
    def self.response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          thread_id: APISchemas.uuid_field,
          chat_type: {type: :string, description: 'Type of chat (brainstorm, website, ads, deploy)'},
          project_id: APISchemas.id_field,
          account_id: APISchemas.id_field,
          name: {type: :string, nullable: true, description: 'Chat name'},
          **APISchemas.timestamps
        },
        required: %w[id thread_id chat_type project_id account_id created_at updated_at]
      }
    end

    # Chat create params schema
    def self.create_params_schema
      {
        type: :object,
        properties: {
          chat: {
            type: :object,
            properties: {
              thread_id: {
                type: :string,
                description: 'Thread ID from Langgraph'
              },
              chat_type: {
                type: :string,
                enum: %w[brainstorm website ads deploy],
                description: 'Type of chat'
              },
              project_id: {
                type: :integer,
                description: 'Project ID to associate the chat with'
              },
              name: {
                type: :string,
                description: 'Optional name for the chat'
              }
            },
            required: %w[thread_id chat_type project_id]
          }
        },
        required: ['chat']
      }
    end

    # Thread validation params schema
    def self.validate_params_schema
      {
        type: :object,
        properties: {
          thread_id: {
            type: :string,
            description: 'Thread ID to validate'
          }
        },
        required: ['thread_id']
      }
    end

    # Thread validation response schema
    def self.validate_response
      {
        type: :object,
        properties: {
          valid: {type: :boolean, description: 'Whether the thread is valid for this account'},
          exists: {type: :boolean, description: 'Whether the thread exists'},
          chat_type: {type: :string, nullable: true, description: 'Type of chat if exists'},
          project_id: {type: :integer, nullable: true, description: 'Project ID if exists'}
        },
        required: %w[valid exists]
      }
    end
  end
end
