# frozen_string_literal: true

module APISchemas
  module AgentContextEvent
    # Single context event response
    def self.event_response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          event_type: {type: :string, description: "Type of the context event"},
          payload: {type: :object, additionalProperties: true, description: "Event payload data"},
          created_at: APISchemas.timestamp_field
        },
        required: %w[id event_type payload created_at]
      }
    end

    # List of context events response
    def self.list_response
      {
        type: :array,
        items: event_response
      }
    end
  end
end
