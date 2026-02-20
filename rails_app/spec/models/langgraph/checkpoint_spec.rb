require "rails_helper"

RSpec.describe Langgraph::Checkpoint do
  let(:thread_id) { SecureRandom.uuid }
  let(:checkpoint_ns) { "" }
  let(:checkpoint_id) { "1ef-abc" }
  let(:channel_versions) { {"status" => "v1", "messages" => "v2", "websiteId" => "v3"} }

  before do
    # Insert directly — these are Langgraph-owned tables
    ActiveRecord::Base.connection.execute(<<~SQL)
      INSERT INTO checkpoints (thread_id, checkpoint_ns, checkpoint_id, checkpoint, metadata)
      VALUES ('#{thread_id}', '#{checkpoint_ns}', '#{checkpoint_id}',
              '#{{"channel_versions" => channel_versions}.to_json}',
              '{"source": "loop", "step": 5}')
    SQL

    channel_versions.each do |channel, version|
      value = case channel
              when "status" then '"completed"'
              when "messages" then '[{"role":"human","content":"hello"}]'
              when "websiteId" then "42"
              end
      blob = ActiveRecord::Base.connection.quote(value)
      ActiveRecord::Base.connection.execute(<<~SQL)
        INSERT INTO checkpoint_blobs (thread_id, checkpoint_ns, channel, version, type, blob)
        VALUES ('#{thread_id}', '#{checkpoint_ns}', '#{channel}', '#{version}', 'json', #{blob})
      SQL
    end
  end

  describe "readonly" do
    it "prevents saving" do
      cp = described_class.for_thread(thread_id).first
      expect { cp.save! }.to raise_error(ActiveRecord::ReadOnlyRecord)
    end
  end

  describe ".state_for" do
    it "reconstructs full thread state from checkpoint + blobs" do
      state = described_class.state_for(thread_id)

      expect(state).to be_a(Langgraph::ThreadState)
      expect(state["status"]).to eq("completed")
      expect(state["websiteId"]).to eq(42)
      expect(state["messages"]).to eq([{"role" => "human", "content" => "hello"}])
    end

    it "returns nil for unknown thread" do
      expect(described_class.state_for("nonexistent")).to be_nil
    end
  end

  describe ".state_for with :only / :except" do
    it "loads only specified channels" do
      state = described_class.state_for(thread_id, only: [:status])

      expect(state["status"]).to eq("completed")
      expect(state.key?("messages")).to be false
    end

    it "excludes specified channels" do
      state = described_class.state_for(thread_id, except: [:messages])

      expect(state["status"]).to eq("completed")
      expect(state.key?("messages")).to be false
    end
  end

  describe "#channel_value" do
    it "loads a single channel without loading everything" do
      cp = described_class.for_thread(thread_id).first
      expect(cp.channel_value(:status)).to eq("completed")
    end
  end

  describe "scopes" do
    it ".latest_for_thread returns the most recent checkpoint" do
      ActiveRecord::Base.connection.execute(<<~SQL)
        INSERT INTO checkpoints (thread_id, checkpoint_ns, checkpoint_id, checkpoint, metadata)
        VALUES ('#{thread_id}', '', '2ef-def', '{"channel_versions": {}}', '{}')
      SQL

      latest = described_class.latest_for_thread(thread_id).first
      expect(latest.checkpoint_id).to eq("2ef-def")
    end
  end
end
