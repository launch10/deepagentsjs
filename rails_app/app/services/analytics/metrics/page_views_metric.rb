# frozen_string_literal: true

module Analytics
  module Metrics
    # Calculates page views metrics from Ahoy visits (L10.track).
    #
    # For historical dates, uses pre-computed data from analytics_daily_metrics.
    # For today, queries live from ahoy_visits.
    #
    class PageViewsMetric < BaseMetric
      # Generate time series data for page views.
      #
      # @return [Hash] Time series with :dates, :series, :totals
      #
      def time_series
        series = build_series
        current_total = series.sum { |s| s[:data].sum }

        # Calculate previous period total for trend
        prev_start, prev_end = previous_period_range
        previous_total = AnalyticsDailyMetric
          .for_account(account)
          .for_date_range(prev_start, prev_end)
          .sum(:page_views_count)

        trend = calculate_trend(current_total, previous_total)

        build_time_series_response(
          series: series,
          totals: {
            current: current_total,
            previous: previous_total,
            **trend
          }
        )
      end

      private

      def build_series
        projects_with_data.map do |project|
          {
            project_id: project.id,
            project_uuid: project.uuid,
            project_name: project.name,
            data: daily_counts_for_project(project)
          }
        end
      end

      def projects_with_data
        account.projects.includes(website: :domains)
      end

      def daily_counts_for_project(project)
        # Get pre-computed counts for historical dates
        historical = historical_counts_for_project(project)

        # Get live counts for today
        today_count = live_count_for_project_today(project)

        # Build array for each date in range
        (start_date..end_date).map do |date|
          if date == Date.current
            today_count
          else
            historical[date] || 0
          end
        end
      end

      def historical_counts_for_project(project)
        AnalyticsDailyMetric
          .where(project: project)
          .for_date_range(start_date, end_date - 1.day)
          .pluck(:date, :page_views_count)
          .to_h
      end

      def live_count_for_project_today(project)
        return 0 unless project.website

        Ahoy::Visit
          .where(website: project.website)
          .where(started_at: Date.current.all_day)
          .count
      end
    end
  end
end
