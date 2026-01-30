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

    def build_summary
      totals = AnalyticsDailyMetric
        .for_project(project)
        .for_date_range(@start_date, @end_date)
        .select(
          "SUM(cost_micros) as total_cost_micros",
          "SUM(leads_count) as total_leads",
          "SUM(impressions) as total_impressions",
          "SUM(clicks) as total_clicks",
          "SUM(conversion_value_cents) as total_conversion_value_cents"
        ).take

      cost_dollars = (totals&.total_cost_micros || 0) / 1_000_000.0
      leads = totals&.total_leads || 0
      conversion_value_dollars = (totals&.total_conversion_value_cents || 0) / 100.0

      roas = (cost_dollars > 0) ? (conversion_value_dollars / cost_dollars).round(2) : nil
      cpl = (leads > 0) ? (cost_dollars / leads).round(2) : nil

      {
        ad_spend: cost_dollars.round(2).to_f,
        leads: leads.to_i,
        cpl: cpl&.to_f,
        roas: roas&.to_f
      }
    end

    def build_time_series(column)
      # Query daily values
      daily_data = AnalyticsDailyMetric
        .for_project(project)
        .for_date_range(@start_date, @end_date)
        .group(:date)
        .order(:date)
        .sum(column)

      # Fill gaps with zeros
      dates = (@start_date..@end_date).to_a
      data = dates.map { |d| daily_data[d] || 0 }

      {
        dates: dates.map(&:iso8601),
        data: data,
        totals: calculate_totals(data)
      }
    end

    def build_ctr_time_series
      # Query daily impressions and clicks
      daily_data = AnalyticsDailyMetric
        .for_project(project)
        .for_date_range(@start_date, @end_date)
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

      {
        dates: dates.map(&:iso8601),
        data: data,
        totals: calculate_ctr_totals
      }
    end

    def calculate_totals(data)
      current = data.sum
      midpoint = data.length / 2
      previous_half = data[0...midpoint].sum
      current_half = data[midpoint..].sum

      trend_percent = if previous_half > 0
        ((current_half - previous_half).to_f / previous_half * 100).round(1)
      else
        0
      end

      {
        current: current,
        previous: previous_half,
        trend_percent: trend_percent.abs,
        trend_direction: if trend_percent > 0
                           "up"
                         else
                           ((trend_percent < 0) ? "down" : "flat")
                         end
      }
    end

    def calculate_ctr_totals
      current = AnalyticsDailyMetric
        .for_project(project)
        .for_date_range(@start_date, @end_date)
        .select("SUM(impressions) as impressions, SUM(clicks) as clicks")
        .take

      current_ctr = if current&.impressions.to_i > 0
        (current.clicks.to_f / current.impressions).round(4)
      else
        0.0
      end

      # Previous period for comparison
      prev_end = @start_date - 1.day
      prev_start = prev_end - days + 1

      previous = AnalyticsDailyMetric
        .for_project(project)
        .for_date_range(prev_start, prev_end)
        .select("SUM(impressions) as impressions, SUM(clicks) as clicks")
        .take

      previous_ctr = if previous&.impressions.to_i > 0
        (previous.clicks.to_f / previous.impressions).round(4)
      else
        0.0
      end

      trend_percent = if previous_ctr > 0
        ((current_ctr - previous_ctr) / previous_ctr * 100).round(1)
      else
        0
      end

      {
        current: current_ctr,
        previous: previous_ctr,
        trend_percent: trend_percent.abs,
        trend_direction: if trend_percent > 0
                           "up"
                         else
                           ((trend_percent < 0) ? "down" : "flat")
                         end
      }
    end
  end
end
