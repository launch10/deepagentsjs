# frozen_string_literal: true

module APISchemas
  module Deploy
    def self.response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          project_id: APISchemas.id_field,
          status: {type: :string, description: "Deploy status (pending, running, completed, failed)"},
          current_step: {type: :string, nullable: true, description: "Current deploy step"},
          is_live: {type: :boolean, description: "Whether the deploy is live"},
          thread_id: {type: :string, nullable: true, description: "Chat thread ID"},
          **APISchemas.timestamps
        },
        required: %w[id project_id status is_live created_at updated_at]
      }
    end

    def self.params_schema
      {
        type: :object,
        properties: {
          project_id: {type: :integer, description: "Project ID to create the deploy for"},
          thread_id: {type: :string, description: "Thread ID from Langgraph for chat creation"}
        },
        required: ["project_id"]
      }
    end

    def self.touch_response
      {
        type: :object,
        properties: {
          touched_at: APISchemas.timestamp_field
        },
        required: ["touched_at"]
      }
    end
  end
end
