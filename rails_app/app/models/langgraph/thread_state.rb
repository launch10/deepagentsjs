module Langgraph
  class ThreadState
    attr_reader :checkpoint, :channel_values

    delegate :thread_id, :checkpoint_ns, :checkpoint_id,
             :channel_versions, :metadata, :run_id, to: :checkpoint

    def initialize(checkpoint:, channel_values:)
      @checkpoint = checkpoint
      @channel_values = channel_values.freeze
    end

    def [](channel_name)     = channel_values[channel_name.to_s]
    def key?(channel_name)   = channel_values.key?(channel_name.to_s)
    def channels             = channel_values.keys
    def to_h                 = channel_values.dup

    # Convenience accessors for common channels
    def messages
      raw = self["messages"]
      return [] unless raw.is_a?(Array)
      raw.map { |msg| parse_message(msg) }
    end

    %w[status error].each do |ch|
      define_method(ch) { self[ch] }
    end

    %w[websiteId projectId accountId brainstormId campaignId deployId].each do |ch|
      define_method(ch.underscore) { self[ch] }
    end

    %w[tasks todos phases].each do |ch|
      define_method(ch) { self[ch] || [] }
    end

    private

    def parse_message(msg)
      return msg unless msg.is_a?(Hash) && msg["lc"] == 1 && msg["type"] == "constructor"

      kwargs = msg["kwargs"] || {}
      type_name = msg.dig("id")&.last || "unknown"
      role = case type_name
             when "HumanMessage" then "human"
             when "AIMessage" then "ai"
             when "SystemMessage" then "system"
             when "ToolMessage" then "tool"
             else type_name.underscore
             end

      {"role" => role, "content" => kwargs["content"],
        "id" => kwargs["id"], "tool_calls" => kwargs.dig("additional_kwargs", "tool_calls")}.compact
    end
  end
end
