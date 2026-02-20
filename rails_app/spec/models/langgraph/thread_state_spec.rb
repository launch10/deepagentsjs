require "rails_helper"

RSpec.describe Langgraph::ThreadState do
  let(:checkpoint) do
    instance_double(
      Langgraph::Checkpoint,
      thread_id: "abc-123",
      checkpoint_ns: "",
      checkpoint_id: "cp-1",
      channel_versions: {},
      metadata: {"source" => "loop"},
      run_id: "run-1"
    )
  end

  subject(:state) do
    described_class.new(
      checkpoint: checkpoint,
      channel_values: {
        "status" => "completed",
        "websiteId" => 42,
        "projectId" => 7,
        "messages" => [
          {"lc" => 1, "type" => "constructor", "id" => ["langchain_core", "messages", "HumanMessage"],
           "kwargs" => {"content" => "Build me a page", "id" => "msg-1"}},
          {"lc" => 1, "type" => "constructor", "id" => ["langchain_core", "messages", "AIMessage"],
           "kwargs" => {"content" => "Sure!", "id" => "msg-2",
                        "additional_kwargs" => {"tool_calls" => [{"name" => "write_file"}]}}},
        ],
        "tasks" => [{"name" => "deploy"}],
        "error" => nil
      }
    )
  end

  it "provides hash-like access with string or symbol keys" do
    expect(state["status"]).to eq("completed")
    expect(state[:status]).to eq("completed")
  end

  it "lists channels" do
    expect(state.channels).to include("status", "messages", "websiteId")
  end

  it "delegates to checkpoint" do
    expect(state.thread_id).to eq("abc-123")
    expect(state.metadata).to eq({"source" => "loop"})
  end

  describe "#messages" do
    it "parses Langgraph constructor format into simple hashes" do
      msgs = state.messages
      expect(msgs.length).to eq(2)

      expect(msgs[0]).to eq("role" => "human", "content" => "Build me a page", "id" => "msg-1")
      expect(msgs[1]).to include("role" => "ai", "content" => "Sure!")
      expect(msgs[1]["tool_calls"]).to eq([{"name" => "write_file"}])
    end

    it "returns empty array when no messages channel" do
      empty_state = described_class.new(checkpoint: checkpoint, channel_values: {})
      expect(empty_state.messages).to eq([])
    end
  end

  describe "convenience accessors" do
    it "maps camelCase channels to snake_case methods" do
      expect(state.website_id).to eq(42)
      expect(state.project_id).to eq(7)
    end

    it "returns empty array for missing collection channels" do
      expect(state.todos).to eq([])
      expect(state.phases).to eq([])
    end

    it "returns present collection channels" do
      expect(state.tasks).to eq([{"name" => "deploy"}])
    end
  end

  describe "#to_h" do
    it "returns a mutable copy of channel values" do
      h = state.to_h
      h["new_key"] = "test"
      expect(state.key?("new_key")).to be false
    end
  end
end
