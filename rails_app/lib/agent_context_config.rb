# frozen_string_literal: true

# Loads agent context event configuration from shared exports.
# Source of truth: shared/config/agentContext.ts
class AgentContextConfig
  class << self
    def valid_event_types
      @valid_event_types ||= load_config("ALL_EVENT_TYPES")
    end

    def subscriptions
      @subscriptions ||= load_config("agentEventSubscriptions")
    end

    def valid_event_type?(event_type)
      valid_event_types.include?(event_type)
    end

    def event_types_for_graph(graph_name)
      subscriptions[graph_name] || []
    end

    def reload!
      @valid_event_types = nil
      @subscriptions = nil
    end

    private

    def load_config(name)
      path = Rails.root.join("../shared/exports/#{name}.json")
      JSON.parse(File.read(path))
    end
  end
end
