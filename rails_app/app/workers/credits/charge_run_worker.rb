# frozen_string_literal: true

module Credits
  # Processes LLM usage records for a run and charges the account.
  #
  # This worker:
  # 1. Finds all unprocessed usage records for the run
  # 2. Calculates cost in millicredits for each record
  # 3. Updates each record with cost_millicredits and processed_at
  # 4. Creates a single consumption transaction for the total
  #
  # The entire operation is wrapped in a transaction for atomicity.
  # Unknown models will raise and cause the job to retry.
  #
  class ChargeRunWorker < ApplicationWorker
    sidekiq_options queue: :billing, retry: 3

    def credits_disabled?
      return false if Rails.env.production?
      true if ENV["CREDITS_DISABLED"] == "true"
    end

    def perform(run_id)
      return if credits_disabled?

      records = LLMUsage.unprocessed.for_run(run_id).to_a
      return if records.empty?

      chat = records.first.chat
      return unless chat&.account

      account = chat.account
      total_cost = 0
      record_count = records.size

      LLMUsage.transaction do
        records.each do |record|
          # Unknown models raise - fail loudly, don't swallow
          cost = Credits::CostCalculator.new(record).call
          record.update!(cost_millicredits: cost, processed_at: Time.current)
          total_cost += cost
        end

        if total_cost > 0
          Credits::ConsumptionService.new(account).consume!(
            cost_millicredits: total_cost,
            idempotency_key: "llm_run:#{run_id}",
            reference_id: run_id,
            metadata: { chat_id: chat.id, record_count: record_count }
          )
        end
      end
    end
  end
end
