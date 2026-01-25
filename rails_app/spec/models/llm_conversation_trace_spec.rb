# == Schema Information
#
# Table name: llm_conversation_traces
#
#  id            :bigint           not null, primary key
#  graph_name    :string
#  llm_calls     :jsonb
#  messages      :jsonb            not null
#  system_prompt :text
#  usage_summary :jsonb
#  created_at    :datetime         not null, primary key
#  chat_id       :bigint           not null
#  run_id        :string           not null
#  thread_id     :string           not null
#
# Indexes
#
#  llm_conversation_traces_chat_id_created_at_idx    (chat_id,created_at)
#  llm_conversation_traces_run_id_created_at_idx     (run_id,created_at) UNIQUE
#  llm_conversation_traces_thread_id_created_at_idx  (thread_id,created_at)
#
require "rails_helper"

RSpec.describe LLMConversationTrace, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:chat).optional }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:thread_id) }
    it { is_expected.to validate_presence_of(:run_id) }
    it { is_expected.to validate_presence_of(:messages) }
  end

  describe "scopes" do
    describe ".for_thread" do
      let!(:trace1) { create(:llm_conversation_trace, thread_id: "thread-123") }
      let!(:trace2) { create(:llm_conversation_trace, thread_id: "thread-456") }

      it "filters by thread_id" do
        expect(described_class.for_thread("thread-123").pluck(:run_id)).to eq([trace1.run_id])
      end
    end

    describe ".for_chat" do
      let(:chat) { create(:chat) }
      let!(:mine) { create(:llm_conversation_trace, chat: chat) }
      let!(:other) { create(:llm_conversation_trace) }

      it "filters by chat" do
        expect(described_class.for_chat(chat).pluck(:run_id)).to eq([mine.run_id])
      end
    end

    describe ".recent" do
      let!(:old) { create(:llm_conversation_trace, created_at: 2.days.ago) }
      let!(:new) { create(:llm_conversation_trace, created_at: 1.day.ago) }

      it "orders by created_at descending" do
        expect(described_class.recent.pluck(:run_id)).to eq([new.run_id, old.run_id])
      end
    end
  end

  describe "#llm_call_count" do
    it "returns count of llm_calls when present" do
      trace = build(:llm_conversation_trace, llm_calls: [{ model: "gpt-4" }, { model: "claude" }])
      expect(trace.llm_call_count).to eq(2)
    end

    it "returns 0 when llm_calls is nil" do
      trace = build(:llm_conversation_trace, llm_calls: nil)
      expect(trace.llm_call_count).to eq(0)
    end
  end

  describe "#total_cost_cents" do
    it "returns cost from usage_summary when present" do
      trace = build(:llm_conversation_trace, usage_summary: { "total_cost_microcents" => 150_000 })
      expect(trace.total_cost_cents).to eq(15.0)
    end

    it "returns 0 when usage_summary is nil" do
      trace = build(:llm_conversation_trace, usage_summary: nil)
      expect(trace.total_cost_cents).to eq(0)
    end
  end
end
