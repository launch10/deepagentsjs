# frozen_string_literal: true

module APISchemas
  module JobRun
    STATUSES = %w[pending running completed failed].freeze

    def self.response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          status: {
            type: :string,
            enum: STATUSES,
            description: 'Current status of the job run'
          }
        },
        required: %w[id status]
      }
    end

    def self.params_schema
      {
        type: :object,
        properties: {
          job_class: {
            type: :string,
            description: 'The worker class to execute (e.g., CampaignDeployWorker)'
          },
          arguments: {
            type: :object,
            additionalProperties: true,
            description: 'Arguments to pass to the worker'
          },
          thread_id: {
            type: :string,
            description: 'LangGraph thread ID for callback resumption'
          },
          callback_url: {
            type: :string,
            description: 'URL to receive webhook callback when job completes'
          }
        },
        required: %w[job_class arguments thread_id callback_url]
      }
    end

    def self.error_response
      {
        type: :object,
        properties: {
          errors: {
            type: :array,
            items: {type: :string},
            description: 'Validation error messages'
          }
        },
        required: [:errors]
      }
    end
  end
end
