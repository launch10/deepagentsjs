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
          thread_id: {type: :string, nullable: true, description: "Langgraph thread ID"},
          instructions: {type: :object, additionalProperties: {type: :boolean}, description: "Deploy instruction flags"},
          support_ticket: {type: :string, nullable: true, description: "Support ticket reference (SR-XXXXXXXX)"},
          finished_at: {type: :string, format: "date-time", nullable: true, description: "When the deploy finished"},
          duration: {type: [:number, :null], description: "Deploy duration in seconds"},
          revertible: {type: :boolean, description: "Whether this deploy can be rolled back"},
          website_deploy_status: {type: :string, nullable: true, description: "Status of the linked website deploy"},
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
          thread_id: {type: :string, description: "Thread ID from Langgraph"}
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

    def self.list_response
      {
        type: :object,
        properties: {
          deploys: {type: :array, items: response},
          pagination: APISchemas::Project.pagination_response
        },
        required: %w[deploys pagination]
      }
    end

    def self.deactivate_response
      {
        type: :object,
        properties: {
          success: {type: :boolean}
        },
        required: ["success"]
      }
    end

    def self.rollback_response
      {
        type: :object,
        properties: {
          success: {type: :boolean}
        },
        required: ["success"]
      }
    end
  end
end
