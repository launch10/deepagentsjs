# frozen_string_literal: true

module APISchemas
  module AppEvent
    def self.create_request
      {
        type: :object,
        properties: {
          event_name: {type: :string, description: "Name of the event to track"},
          user_id: {type: :integer, description: "User ID", nullable: true},
          project_id: {type: :integer, description: "Project ID", nullable: true},
          properties: {
            type: :object,
            additionalProperties: true,
            description: "Additional event properties",
            nullable: true
          }
        },
        required: %w[event_name]
      }
    end
  end
end
