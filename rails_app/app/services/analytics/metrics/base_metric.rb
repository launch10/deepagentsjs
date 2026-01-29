# frozen_string_literal: true

module Analytics
  module Metrics
    # Base class for all metric calculators.
    #
    # Provides common functionality for date range handling, trend calculation,
    # and time series formatting.
    #
    class BaseMetric
      attr_reader :account, :start_date, :end_date

      def initialize(account, start_date, end_date)
        @account = account
        @start_date = start_date.to_date
        @end_date = end_date.to_date
      end

      # Generate date array for the range.
      #
      # @return [Array<String>] ISO formatted dates
      #
      def date_range_array
        (@start_date..@end_date).map { |d| d.iso8601 }
      end

      # Calculate the number of days in the range.
      #
      # @return [Integer]
      #
      def days_in_range
        (@end_date - @start_date).to_i + 1
      end

      protected

      # Calculate trend between current and previous periods.
      #
      # @param current_total [Numeric] Total for current period
      # @param previous_total [Numeric] Total for previous period
      # @return [Hash] Trend data with :trend_percent and :trend_direction
      #
      def calculate_trend(current_total, previous_total)
        if previous_total.nil? || previous_total.zero?
          {
            trend_percent: current_total.zero? ? 0.0 : 100.0,
            trend_direction: current_total.zero? ? "flat" : "up"
          }
        else
          change = current_total - previous_total
          percent = (change.to_f / previous_total * 100).round(1)
          {
            trend_percent: percent.abs,
            trend_direction: if percent > 0
                               "up"
                             else
                               ((percent < 0) ? "down" : "flat")
                             end
          }
        end
      end

      # Build standard time series response format.
      #
      # @param series [Array<Hash>] Series data per project
      # @param totals [Hash] Totals with :current, :previous, trend info
      # @return [Hash] Standardized time series format
      #
      def build_time_series_response(series:, totals:)
        {
          dates: date_range_array,
          series: series,
          totals: totals
        }
      end

      # Get the previous period date range for trend comparison.
      #
      # @return [Array<Date, Date>] Start and end dates of previous period
      #
      def previous_period_range
        period_length = days_in_range
        prev_end = @start_date - 1.day
        prev_start = prev_end - period_length + 1
        [prev_start, prev_end]
      end
    end
  end
end
