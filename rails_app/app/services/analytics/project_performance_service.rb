# frozen_string_literal: true

module Analytics
  # Calculates performance metrics for a single project.
  #
  # Provides summary statistics and time series data for the project
  # performance page, including ad spend, leads, CPL, ROAS, and
  # engagement metrics (impressions, clicks, CTR).
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
      # Cache the base query results to avoid repeated queries
      @daily_metrics ||= fetch_daily_metrics
      @previous_metrics ||= fetch_previous_period_metrics

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

    private

    def fetch_daily_metrics
      AnalyticsDailyMetric
        .for_project(project)
        .for_date_range(@start_date, @end_date)
    end

    def fetch_previous_period_metrics
      prev_start, prev_end = previous_period_dates
      AnalyticsDailyMetric
        .for_project(project)
        .for_date_range(prev_start, prev_end)
    end

    def previous_period_dates
      prev_end = @start_date - 1.day
      prev_start = prev_end - days + 1
      [prev_start, prev_end]
    end

    def build_summary
      totals = @daily_metrics
        .select(
          "SUM(cost_micros) as total_cost_micros",
          "SUM(leads_count) as total_leads",
          "SUM(conversion_value_cents) as total_conversion_value_cents"
        ).take

      cost_dollars = (totals&.total_cost_micros || 0) / 1_000_000.0
      leads = totals&.total_leads || 0
      conversion_value_dollars = (totals&.total_conversion_value_cents || 0) / 100.0

      # Previous period values
      prev_totals = @previous_metrics
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

    def build_time_series(column)
      daily_data = @daily_metrics.group(:date).order(:date).sum(column)
      previous_total = @previous_metrics.sum(column)

      dates = (@start_date..@end_date).to_a
      data = dates.map { |d| daily_data[d] || 0 }
      current_total = data.sum

      {
        dates: dates.map(&:iso8601),
        data: data,
        totals: build_totals(current_total, previous_total)
      }
    end

    def build_ctr_time_series
      daily_data = @daily_metrics
        .group(:date)
        .order(:date)
        .select("date, SUM(impressions) as impressions, SUM(clicks) as clicks")
        .index_by(&:date)

      dates = (@start_date..@end_date).to_a
      data = dates.map do |date|
        record = daily_data[date]
        if record && record.impressions.to_i > 0
          (record.clicks.to_f / record.impressions).round(4)
        else
          0.0
        end
      end

      # Calculate CTR totals
      current = @daily_metrics
        .select("SUM(impressions) as impressions, SUM(clicks) as clicks")
        .take

      current_ctr = if current&.impressions.to_i > 0
        (current.clicks.to_f / current.impressions).round(4)
      else
        0.0
      end

      previous = @previous_metrics
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

    # Unified trend calculation - always compares to previous period
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
