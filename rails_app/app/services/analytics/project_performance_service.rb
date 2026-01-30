# frozen_string_literal: true

module Analytics
  # Calculates performance metrics for a single project.
  #
  # Provides summary statistics and time series data for the project
  # performance page, including ad spend, leads, CPL, ROAS, and
  # engagement metrics (impressions, clicks, CTR).
  #
  # == Data Freshness Pattern (Historical + Live)
  #
  # This service intentionally uses a HYBRID data pattern to balance
  # query performance with data freshness:
  #
  # - HISTORICAL (before today): Pre-computed from `analytics_daily_metrics`
  #   - Computed daily at 5 AM by ComputeDailyMetricsWorker
  #   - Fast queries on indexed, aggregated data
  #
  # - TODAY: Live queries from source tables
  #   - Real-time for in-house data (leads, conversions)
  #   - Near-real-time for Google Ads (synced hourly, 2-4hr API lag)
  #
  # == Data Freshness by Source
  #
  # | Source                | Raw Freshness        | With 15-min Cache |
  # |-----------------------|----------------------|-------------------|
  # | Leads (WebsiteLead)   | Real-time            | ≤15 min stale     |
  # | Conversions (Ahoy)    | Real-time            | ≤15 min stale     |
  # | Google Ads metrics    | 3-5 hrs (API lag +   | ≤5 hrs stale      |
  # | (impressions, clicks, |  hourly sync)        |                   |
  # |  cost_micros)         |                      |                   |
  #
  # == Date Boundary (NO DOUBLE COUNTING)
  #
  # The date boundary is INTENTIONALLY exclusive to prevent double-counting:
  #
  #   Historical: @start_date → Date.yesterday (EXCLUDES today)
  #   Live:       Date.current only
  #
  # This means if analytics_daily_metrics accidentally has a record for
  # today (e.g., from a mid-day job run), it will be IGNORED. Only live
  # source tables are queried for today's data.
  #
  # See: spec/services/analytics/project_performance_service_spec.rb
  #      "date boundary - no double counting" tests
  #
  class ProjectPerformanceService
    attr_reader :project, :days

    def initialize(project, days: 30)
      @project = project
      @days = days
      @start_date = days.days.ago.to_date
      @end_date = Date.current
    end

    # Get all metrics for the project.
    #
    # @return [Hash] Performance data with :summary, :impressions, :clicks, :ctr, :has_data
    #
    def metrics
      CacheService.fetch(project.account_id, "project:#{project.id}:performance", days) do
        compute_metrics
      end
    end

    private

    def compute_metrics
      summary = build_summary
      impressions = build_time_series(:impressions)
      clicks = build_time_series(:clicks)
      ctr = build_ctr_time_series

      # Determine if there's any meaningful data
      has_data = summary[:ad_spend] > 0 ||
        summary[:leads] > 0 ||
        impressions[:totals][:current] > 0 ||
        clicks[:totals][:current] > 0

      {
        summary: summary,
        impressions: impressions,
        clicks: clicks,
        ctr: ctr,
        has_data: has_data
      }
    end

    # --- Data Fetching (Historical + Live) ---
    #
    # IMPORTANT: The date boundary between historical and live data is
    # Date.yesterday / Date.current. This is INTENTIONAL to prevent
    # double-counting. See class documentation for details.

    def historical_metrics
      # EXCLUDES today - only pre-computed data up to yesterday
      @historical_metrics ||= AnalyticsDailyMetric
        .for_project(project)
        .for_date_range(@start_date, Date.yesterday)
    end

    def previous_period_metrics
      @previous_period_metrics ||= begin
        prev_start, prev_end = previous_period_dates
        AnalyticsDailyMetric
          .for_project(project)
          .for_date_range(prev_start, prev_end)
      end
    end

    def previous_period_dates
      prev_end = @start_date - 1.day
      prev_start = prev_end - days + 1
      [prev_start, prev_end]
    end

    # --- Live Data for Today ---
    #
    # These methods query source tables directly for TODAY's data only.
    # This provides real-time freshness for in-house data (leads, conversions)
    # and near-real-time for Google Ads (~hourly sync, 2-4hr API lag).

    def live_ads_metrics_today
      # Google Ads data: ~3-5 hours stale (hourly sync + 2-4hr API lag)
      @live_ads_metrics_today ||= begin
        campaign_ids = project.campaigns.pluck(:id)
        return { impressions: 0, clicks: 0, cost_micros: 0 } if campaign_ids.empty?

        result = AdPerformanceDaily
          .where(campaign_id: campaign_ids)
          .where(date: Date.current)
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

    def live_leads_count_today
      # In-house data: real-time (only delayed by 15-min cache)
      @live_leads_count_today ||= begin
        return 0 unless project.website

        WebsiteLead
          .where(website: project.website)
          .where(created_at: Date.current.all_day)
          .count
      end
    end

    def live_conversion_value_today
      # In-house data: real-time (only delayed by 15-min cache)
      @live_conversion_value_today ||= begin
        return 0 unless project.website

        conversion_events = Ahoy::Event
          .joins(:visit)
          .where(ahoy_visits: { website_id: project.website.id })
          .where(name: "conversion")
          .where(time: Date.current.all_day)

        return 0 if conversion_events.empty?

        total_dollars = conversion_events.sum { |e| e.properties["value"].to_f }
        (total_dollars * 100).to_i
      end
    end

    # --- Summary Building ---

    def build_summary
      # Historical totals (excluding today)
      hist_totals = historical_metrics
        .select(
          "SUM(cost_micros) as total_cost_micros",
          "SUM(leads_count) as total_leads",
          "SUM(conversion_value_cents) as total_conversion_value_cents"
        ).take

      # Add today's live data
      cost_micros = (hist_totals&.total_cost_micros || 0) + live_ads_metrics_today[:cost_micros]
      leads = (hist_totals&.total_leads || 0) + live_leads_count_today
      conversion_value_cents = (hist_totals&.total_conversion_value_cents || 0) + live_conversion_value_today

      cost_dollars = cost_micros / 1_000_000.0
      conversion_value_dollars = conversion_value_cents / 100.0

      # Previous period values (always from pre-computed)
      prev_totals = previous_period_metrics
        .select(
          "SUM(cost_micros) as total_cost_micros",
          "SUM(leads_count) as total_leads",
          "SUM(conversion_value_cents) as total_conversion_value_cents"
        ).take

      prev_cost_dollars = (prev_totals&.total_cost_micros || 0) / 1_000_000.0
      prev_leads = prev_totals&.total_leads || 0
      prev_conversion_value_dollars = (prev_totals&.total_conversion_value_cents || 0) / 100.0

      roas = (cost_dollars > 0) ? (conversion_value_dollars / cost_dollars).round(2) : nil
      cpl = (leads > 0) ? (cost_dollars / leads).round(2) : nil
      prev_roas = (prev_cost_dollars > 0) ? (prev_conversion_value_dollars / prev_cost_dollars).round(2) : nil
      prev_cpl = (prev_leads > 0) ? (prev_cost_dollars / prev_leads).round(2) : nil

      {
        ad_spend: cost_dollars.round(2).to_f,
        ad_spend_trend: calculate_trend(cost_dollars, prev_cost_dollars),
        leads: leads.to_i,
        leads_trend: calculate_trend(leads, prev_leads),
        cpl: cpl&.to_f,
        cpl_trend: calculate_trend(cpl, prev_cpl),
        roas: roas&.to_f,
        roas_trend: calculate_trend(roas, prev_roas)
      }
    end

    # --- Time Series Building ---

    def build_time_series(column)
      # Historical data by date (excluding today)
      historical_data = historical_metrics.group(:date).order(:date).sum(column)

      # Today's live value
      today_value = case column
      when :impressions then live_ads_metrics_today[:impressions]
      when :clicks then live_ads_metrics_today[:clicks]
      else 0
      end

      previous_total = previous_period_metrics.sum(column)

      dates = (@start_date..@end_date).to_a
      data = dates.map do |date|
        if date == Date.current
          today_value
        else
          historical_data[date] || 0
        end
      end
      current_total = data.sum

      {
        dates: dates.map(&:iso8601),
        data: data,
        totals: build_totals(current_total, previous_total)
      }
    end

    def build_ctr_time_series
      # Historical data by date
      historical_data = historical_metrics
        .group(:date)
        .order(:date)
        .select("date, SUM(impressions) as impressions, SUM(clicks) as clicks")
        .index_by(&:date)

      # Today's live data
      today_impressions = live_ads_metrics_today[:impressions]
      today_clicks = live_ads_metrics_today[:clicks]
      today_ctr = (today_impressions > 0) ? (today_clicks.to_f / today_impressions).round(4) : 0.0

      dates = (@start_date..@end_date).to_a
      data = dates.map do |date|
        if date == Date.current
          today_ctr
        else
          record = historical_data[date]
          if record && record.impressions.to_i > 0
            (record.clicks.to_f / record.impressions).round(4)
          else
            0.0
          end
        end
      end

      # Calculate CTR totals (historical + today)
      hist_agg = historical_metrics
        .select("SUM(impressions) as impressions, SUM(clicks) as clicks")
        .take

      total_impressions = hist_agg&.impressions.to_i + today_impressions
      total_clicks = hist_agg&.clicks.to_i + today_clicks

      current_ctr = (total_impressions > 0) ? (total_clicks.to_f / total_impressions).round(4) : 0.0

      # Previous period CTR
      previous = previous_period_metrics
        .select("SUM(impressions) as impressions, SUM(clicks) as clicks")
        .take

      previous_ctr = if previous&.impressions.to_i > 0
        (previous.clicks.to_f / previous.impressions).round(4)
      else
        0.0
      end

      {
        dates: dates.map(&:iso8601),
        data: data,
        totals: build_totals(current_ctr, previous_ctr)
      }
    end

    # --- Trend Calculations ---

    def build_totals(current_value, previous_value)
      trend = calculate_trend(current_value, previous_value)

      {
        current: current_value,
        previous: previous_value,
        trend_percent: trend[:percent],
        trend_direction: trend[:direction]
      }
    end

    def calculate_trend(current, previous)
      return { percent: 0.0, direction: "flat" } if current.nil? || previous.nil?

      # Handle edge cases where we can't calculate a percentage
      if previous.zero?
        # If previous was 0 but now we have data, that's an increase
        return { percent: 0.0, direction: current.positive? ? "up" : "flat" }
      end

      if current.zero? && previous.positive?
        # If we had data but now it's 0, that's a decrease
        return { percent: 100.0, direction: "down" }
      end

      percent = ((current - previous).to_f / previous * 100).round(1)
      direction = if percent > 0
        "up"
      elsif percent < 0
        "down"
      else
        "flat"
      end

      { percent: percent.abs.to_f, direction: direction }
    end
  end
end
