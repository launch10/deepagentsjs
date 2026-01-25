# frozen_string_literal: true

module Credits
  class DailyReconciliationWorker < ApplicationWorker
    sidekiq_options queue: :billing

    def perform
      query.in_batches(of: 100) do |accounts|
        accounts.each do |account|
          # Use perform_async for proper job isolation and retry semantics
          Credits::ReconcileOneAccountWorker.perform_async(account.id)
        end
      end
    end

    private

    def query
      today = Time.current.to_date

      Account
        .joins(payment_processor: :subscriptions)
        .joins("INNER JOIN plans ON plans.fake_processor_id = pay_subscriptions.processor_plan OR plans.name = pay_subscriptions.processor_plan")
        .where("pay_subscriptions.status = ?", "active")
        .where("plans.interval = ?", "year")
        .where(is_reset_day_sql(today))
        .where.not(has_current_period_allocation_sql(today))
        .distinct
    end

    def is_reset_day_sql(today)
      anchor_day = "EXTRACT(DAY FROM pay_subscriptions.current_period_start)"
      last_day = today.end_of_month.day

      <<~SQL.squish
        ((#{anchor_day} <= #{last_day} AND #{anchor_day} = #{today.day})
        OR (#{anchor_day} > #{last_day} AND #{today.day} = #{last_day}))
      SQL
    end

    def has_current_period_allocation_sql(today)
      month_start = today.beginning_of_month
      month_end = today.next_month.beginning_of_month

      # Use sanitize_sql_array for safe parameterized queries
      ApplicationRecord.sanitize_sql_array([
        <<~SQL.squish,
          EXISTS (
            SELECT 1 FROM credit_transactions ct
            WHERE ct.account_id = accounts.id
            AND ct.transaction_type = 'allocate'
            AND ct.reason IN ('plan_renewal', 'plan_upgrade')
            AND ct.created_at >= ?
            AND ct.created_at < ?
          )
        SQL
        month_start,
        month_end
      ])
    end
  end
end
