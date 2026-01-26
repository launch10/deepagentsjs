# frozen_string_literal: true

module Credits
  # Daily job for monthly credit resets on yearly subscriptions.
  #
  # Yearly subscribers get their credits refreshed monthly on their reset day.
  # This worker identifies accounts due for reset and delegates to ResetPlanCreditsWorker.
  #
  class DailyReconciliationWorker < ApplicationWorker
    sidekiq_options queue: :billing

    def perform
      subscription_query.find_each do |subscription|
        Credits::ResetPlanCreditsWorker.perform_async(subscription.id, "monthly_reset" => true)
      end
    end

    private

    def subscription_query
      today = Time.current.to_date

      Pay::Subscription
        .joins(:customer)
        .joins("INNER JOIN accounts ON accounts.id = pay_customers.owner_id AND pay_customers.owner_type = 'Account'")
        .joins(plan_join_sql)
        .where(status: "active")
        .where("plans.interval = ?", "year")
        .where(is_reset_day_sql(today))
        .where.not(has_current_month_allocation_sql(today))
        .distinct
    end

    def plan_join_sql
      # Join plans by stripe_id or name
      # fake_processor_id is only used in test/dev environments
      conditions = [
        "plans.stripe_id = pay_subscriptions.processor_plan",
        "plans.name = pay_subscriptions.processor_plan"
      ]

      unless Rails.env.production?
        conditions << "plans.fake_processor_id = pay_subscriptions.processor_plan"
      end

      "INNER JOIN plans ON (#{conditions.join(' OR ')})"
    end

    def is_reset_day_sql(today)
      reset_day = "EXTRACT(DAY FROM pay_subscriptions.current_period_start)"
      last_day = today.end_of_month.day

      <<~SQL.squish
        ((#{reset_day} <= #{last_day} AND #{reset_day} = #{today.day})
        OR (#{reset_day} > #{last_day} AND #{today.day} = #{last_day}))
      SQL
    end

    def has_current_month_allocation_sql(today)
      month_start = today.beginning_of_month
      month_end = today.next_month.beginning_of_month

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
