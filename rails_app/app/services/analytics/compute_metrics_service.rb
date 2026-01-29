# frozen_string_literal: true

module Analytics
  # Computes aggregated daily metrics for a single project.
  #
  # Aggregates from raw sources:
  # - website_leads -> leads_count
  # - ahoy_visits -> unique_visitors_count
  # - ahoy_events (page_view) -> page_views_count
  # - ad_performance_daily -> impressions, clicks, cost_micros
  #
  class ComputeMetricsService
    def initialize(project, date:)
      @project = project
      @account = project.account
      @date = date
    end

    # Compute and upsert metrics for this project/date.
    #
    # @return [AnalyticsDailyMetric] The upserted record
    #
    def call
      AnalyticsDailyMetric.upsert(
        {
          account_id: @account.id,
          project_id: @project.id,
          date: @date,
          leads_count: count_leads,
          unique_visitors_count: count_unique_visitors,
          page_views_count: count_page_views,
          **aggregate_ads_metrics,
          created_at: Time.current,
          updated_at: Time.current
        },
        unique_by: [:account_id, :project_id, :date]
      )
    end

    private

    def count_leads
      return 0 unless @project.website

      WebsiteLead
        .where(website: @project.website)
        .where(created_at: @date.all_day)
        .count
    end

    def count_unique_visitors
      return 0 unless @project.website

      Ahoy::Visit
        .where(website: @project.website)
        .where(started_at: @date.all_day)
        .count
    end

    def count_page_views
      return 0 unless @project.website

      Ahoy::Event
        .joins(:visit)
        .where(ahoy_visits: { website_id: @project.website.id })
        .where(name: "page_view")
        .where(time: @date.all_day)
        .count
    end

    def aggregate_ads_metrics
      campaign_ids = @project.campaigns.pluck(:id)
      return { impressions: 0, clicks: 0, cost_micros: 0 } if campaign_ids.empty?

      result = AdPerformanceDaily
        .where(campaign_id: campaign_ids)
        .where(date: @date)
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
  end
end
