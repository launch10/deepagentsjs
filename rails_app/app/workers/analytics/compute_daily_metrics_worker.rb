# frozen_string_literal: true

module Analytics
  # Computes daily analytics metrics by aggregating from source tables.
  #
  # This worker:
  # 1. Iterates through all accounts
  # 2. For each account's projects, aggregates metrics from source tables
  # 3. Upserts into analytics_daily_metrics
  #
  # Sources:
  # - website_leads -> leads_count
  # - domain_request_counts -> page_views_count
  # - ad_performance_daily -> impressions, clicks, cost_micros
  #
  class ComputeDailyMetricsWorker < ApplicationWorker
    sidekiq_options queue: :analytics, retry: 3

    # @param date_string [String, nil] ISO8601 date string (defaults to yesterday)
    #
    def perform(date_string = nil)
      target_date = date_string ? Date.parse(date_string) : Date.yesterday

      Account.find_each do |account|
        compute_for_account(account, target_date)
      rescue StandardError => e
        Rails.logger.error("[ComputeDailyMetricsWorker] Failed for account #{account.id}: #{e.message}")
        Rollbar.error(e, account_id: account.id, date: target_date)
        # Continue processing other accounts
      end
    end

    private

    def compute_for_account(account, date)
      account.projects.find_each do |project|
        compute_for_project(account, project, date)
      end
    end

    def compute_for_project(account, project, date)
      leads_count = count_leads(project, date)
      page_views_count = count_page_views(project, date)
      ads_metrics = aggregate_ads_metrics(project, date)

      upsert_metric(
        account: account,
        project: project,
        date: date,
        leads_count: leads_count,
        page_views_count: page_views_count,
        **ads_metrics
      )
    end

    def count_leads(project, date)
      return 0 unless project.website

      WebsiteLead
        .where(website: project.website)
        .where(created_at: date.all_day)
        .count
    end

    def count_page_views(project, date)
      return 0 unless project.website

      domain_ids = project.website.domains.pluck(:id)
      return 0 if domain_ids.empty?

      DomainRequestCount
        .where(domain_id: domain_ids)
        .where(hour: date.all_day)
        .sum(:request_count)
    end

    def aggregate_ads_metrics(project, date)
      campaign_ids = project.campaigns.pluck(:id)
      return { impressions: 0, clicks: 0, cost_micros: 0 } if campaign_ids.empty?

      result = AdPerformanceDaily
        .where(campaign_id: campaign_ids)
        .where(date: date)
        .select(
          "COALESCE(SUM(impressions), 0) as impressions",
          "COALESCE(SUM(clicks), 0) as clicks",
          "COALESCE(SUM(cost_micros), 0) as cost_micros"
        )
        .take

      {
        impressions: result&.impressions.to_i,
        clicks: result&.clicks.to_i,
        cost_micros: result&.cost_micros.to_i
      }
    end

    def upsert_metric(account:, project:, date:, leads_count:, page_views_count:, impressions:, clicks:, cost_micros:)
      AnalyticsDailyMetric.upsert(
        {
          account_id: account.id,
          project_id: project.id,
          date: date,
          leads_count: leads_count,
          page_views_count: page_views_count,
          impressions: impressions,
          clicks: clicks,
          cost_micros: cost_micros,
          created_at: Time.current,
          updated_at: Time.current
        },
        unique_by: [:account_id, :project_id, :date]
      )
    end
  end
end
