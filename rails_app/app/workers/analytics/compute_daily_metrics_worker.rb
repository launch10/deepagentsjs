# frozen_string_literal: true

module Analytics
  # Enqueues metric computation jobs for each eligible project.
  #
  # Only processes projects that:
  # - Have a live deploy (website is published)
  # - Belong to an account with an active subscription
  #
  # Computes metrics for a 7-day rolling window to stay in sync with
  # Google Ads data (which has attribution lag for late-arriving conversions).
  #
  # This is a batch coordinator - it iterates over projects and enqueues
  # individual ComputeMetricsForProjectWorker jobs for granular retries.
  #
  class ComputeDailyMetricsWorker < ApplicationWorker
    sidekiq_options queue: :analytics, retry: 3

    # @param date_string [String, nil] ISO8601 date string for single-day mode (defaults to rolling window)
    #
    def perform(date_string = nil)
      dates = date_string ? [Date.parse(date_string)] : rolling_window_dates

      self.class.projects_with_live_deploys.find_each do |project|
        dates.each do |date|
          Analytics::ComputeMetricsForProjectWorker.perform_async(project.id, date.iso8601)
        end
      end
    end

    def rolling_window_dates
      # Use the same window as SyncService for Google Ads attribution lag
      (Analytics::SyncService::ROLLING_WINDOW_DAYS.days.ago.to_date..Date.yesterday).to_a
    end

    # Projects with live deploys belonging to subscribed accounts.
    #
    # Uses indexed columns:
    # - deploys.is_live (index_deploys_on_is_live)
    # - pay_subscriptions.status (index_pay_subscriptions_on_status)
    #
    # @return [ActiveRecord::Relation<Project>]
    #
    def self.projects_with_live_deploys
      Project
        .joins(:account, :deploys)
        .joins("INNER JOIN pay_customers ON pay_customers.owner_id = accounts.id AND pay_customers.owner_type = 'Account'")
        .joins("INNER JOIN pay_subscriptions ON pay_subscriptions.customer_id = pay_customers.id")
        .where(pay_subscriptions: { status: "active" })
        .where(deploys: { is_live: true })
        .distinct
    end
  end
end
