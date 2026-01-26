# frozen_string_literal: true

require "rails_helper"

RSpec.describe Credits::FindUnprocessedRunsWorker do
  let(:account) { create(:account) }
  let(:chat) { create(:chat, account: account) }
  let(:worker) { described_class.new }

  let!(:haiku_config) do
    create(:model_config,
      model_key: "haiku",
      model_card: "claude-haiku-4-5",
      cost_in: 1.0,
      cost_out: 5.0)
  end

  describe "#perform" do
    context "with stale unprocessed records" do
      it "enqueues ChargeRunWorker for each distinct run_id" do
        # Stale record (older than 2 minutes)
        create(:llm_usage,
          chat: chat,
          run_id: "stale_run_1",
          model_raw: "claude-haiku-4-5",
          input_tokens: 100,
          processed_at: nil,
          created_at: 5.minutes.ago)

        # Another stale record with different run_id
        create(:llm_usage,
          chat: chat,
          run_id: "stale_run_2",
          model_raw: "claude-haiku-4-5",
          input_tokens: 100,
          processed_at: nil,
          created_at: 3.minutes.ago)

        expect(Credits::ChargeRunWorker).to receive(:perform_async).with("stale_run_1")
        expect(Credits::ChargeRunWorker).to receive(:perform_async).with("stale_run_2")

        worker.perform
      end

      it "groups multiple records from same run into single job" do
        run_id = "grouped_run"

        # Multiple records in same run
        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5",
          input_tokens: 100,
          processed_at: nil,
          created_at: 5.minutes.ago)

        create(:llm_usage,
          chat: chat,
          run_id: run_id,
          model_raw: "claude-haiku-4-5",
          input_tokens: 200,
          processed_at: nil,
          created_at: 5.minutes.ago)

        # Should only enqueue once for this run_id
        expect(Credits::ChargeRunWorker).to receive(:perform_async).with(run_id).once

        worker.perform
      end
    end

    context "with fresh unprocessed records" do
      it "does not enqueue jobs for records less than 2 minutes old" do
        # Fresh record (just created)
        create(:llm_usage,
          chat: chat,
          run_id: "fresh_run",
          model_raw: "claude-haiku-4-5",
          input_tokens: 100,
          processed_at: nil,
          created_at: 30.seconds.ago)

        expect(Credits::ChargeRunWorker).not_to receive(:perform_async)

        worker.perform
      end
    end

    context "with already processed records" do
      it "does not enqueue jobs for processed records" do
        create(:llm_usage,
          chat: chat,
          run_id: "processed_run",
          model_raw: "claude-haiku-4-5",
          input_tokens: 100,
          processed_at: 1.hour.ago,
          cost_millicredits: 10,
          created_at: 1.hour.ago)

        expect(Credits::ChargeRunWorker).not_to receive(:perform_async)

        worker.perform
      end
    end

    context "with mixed records" do
      it "only enqueues for stale unprocessed runs" do
        # Stale unprocessed - should be picked up
        create(:llm_usage,
          chat: chat,
          run_id: "stale_unprocessed",
          model_raw: "claude-haiku-4-5",
          input_tokens: 100,
          processed_at: nil,
          created_at: 5.minutes.ago)

        # Fresh unprocessed - should NOT be picked up
        create(:llm_usage,
          chat: chat,
          run_id: "fresh_unprocessed",
          model_raw: "claude-haiku-4-5",
          input_tokens: 100,
          processed_at: nil,
          created_at: 30.seconds.ago)

        # Processed - should NOT be picked up
        create(:llm_usage,
          chat: chat,
          run_id: "already_processed",
          model_raw: "claude-haiku-4-5",
          input_tokens: 100,
          processed_at: 1.hour.ago,
          cost_millicredits: 10,
          created_at: 1.hour.ago)

        expect(Credits::ChargeRunWorker).to receive(:perform_async).with("stale_unprocessed")

        worker.perform
      end
    end

    context "with no unprocessed records" do
      it "does nothing when no unprocessed records exist" do
        expect(Credits::ChargeRunWorker).not_to receive(:perform_async)

        worker.perform
      end
    end
  end

  describe "staleness threshold" do
    it "has a 2-minute threshold" do
      expect(described_class::STALENESS_THRESHOLD).to eq(2.minutes)
    end
  end

  describe "sidekiq options" do
    it "runs on the billing queue" do
      expect(described_class.sidekiq_options["queue"]).to eq(:billing)
    end
  end
end
