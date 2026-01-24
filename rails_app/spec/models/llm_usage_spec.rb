# == Schema Information
#
# Table name: llm_usage
#
#  id                      :bigint           not null, primary key
#  cache_creation_tokens   :integer          default(0)
#  cache_read_tokens       :integer          default(0)
#  cost_microcents         :bigint
#  graph_name              :string
#  input_tokens            :integer          default(0), not null
#  metadata                :jsonb
#  model_raw               :string           not null
#  output_tokens           :integer          default(0), not null
#  processed_at            :datetime
#  reasoning_tokens        :integer          default(0)
#  tags                    :string           default([]), is an Array
#  created_at              :datetime         not null
#  updated_at              :datetime         not null
#  chat_id                 :bigint           not null
#  langchain_run_id        :string
#  message_id              :string
#  parent_langchain_run_id :string
#  run_id                  :string           not null
#  thread_id               :string           not null
#
# Indexes
#
#  index_llm_usage_on_chat_id_and_run_id           (chat_id,run_id)
#  index_llm_usage_on_processed_at_and_created_at  (processed_at,created_at)
#  index_llm_usage_on_run_id                       (run_id)
#  index_llm_usage_on_thread_id_and_created_at     (thread_id,created_at)
#
require "rails_helper"

RSpec.describe LLMUsage, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:chat).optional }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:thread_id) }
    it { is_expected.to validate_presence_of(:run_id) }
    it { is_expected.to validate_presence_of(:model_raw) }
  end

  describe "attributes" do
    subject(:usage) { described_class.new }

    it "has token count defaults" do
      expect(usage.input_tokens).to eq(0)
      expect(usage.output_tokens).to eq(0)
      expect(usage.reasoning_tokens).to eq(0)
      expect(usage.cache_creation_tokens).to eq(0)
      expect(usage.cache_read_tokens).to eq(0)
    end

    it "has empty tags array default" do
      expect(usage.tags).to eq([])
    end
  end

  describe "scopes" do
    describe ".unprocessed" do
      let!(:processed) { create(:llm_usage, processed_at: Time.current) }
      let!(:unprocessed) { create(:llm_usage, processed_at: nil) }

      it "returns only unprocessed records" do
        expect(described_class.unprocessed).to contain_exactly(unprocessed)
      end
    end

    describe ".for_run" do
      let!(:usage1) { create(:llm_usage, run_id: "run-123") }
      let!(:usage2) { create(:llm_usage, run_id: "run-456") }

      it "filters by run_id" do
        expect(described_class.for_run("run-123")).to contain_exactly(usage1)
      end
    end

    describe ".for_thread" do
      let!(:usage1) { create(:llm_usage, thread_id: "thread-123") }
      let!(:usage2) { create(:llm_usage, thread_id: "thread-456") }

      it "filters by thread_id" do
        expect(described_class.for_thread("thread-123")).to contain_exactly(usage1)
      end
    end
  end

  describe "#processed?" do
    it "returns true when processed_at is set" do
      usage = build(:llm_usage, processed_at: Time.current)
      expect(usage).to be_processed
    end

    it "returns false when processed_at is nil" do
      usage = build(:llm_usage, processed_at: nil)
      expect(usage).not_to be_processed
    end
  end

  describe "#total_tokens" do
    it "sums all token types" do
      usage = build(:llm_usage,
        input_tokens: 100,
        output_tokens: 50,
        reasoning_tokens: 25,
        cache_creation_tokens: 10,
        cache_read_tokens: 5)

      expect(usage.total_tokens).to eq(190)
    end
  end
end
