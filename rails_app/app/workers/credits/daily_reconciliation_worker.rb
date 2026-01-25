# frozen_string_literal: true

module Credits
  class DailyReconciliationWorker < ApplicationWorker
    def perform
      query.in_batches(of: 100) do |accounts|
        accounts.each do |account|
          Credits::ReconcileOneAccountWorker.new.perform(account.id)
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
      <<~SQL.squish
        EXISTS (
          SELECT 1 FROM credit_transactions ct
          WHERE ct.account_id = accounts.id
          AND ct.transaction_type = 'allocate'
          AND ct.reason IN ('plan_renewal', 'plan_upgrade')
          AND ct.created_at >= '#{today.beginning_of_month}'
          AND ct.created_at < '#{today.next_month.beginning_of_month}'
        )
      SQL
    end
  end
end
