# frozen_string_literal: true

module Analytics
  module Metrics
    # Calculates Google Ads metrics (CTR, CPL) from ad_performance_daily.
    #
    # Handles graceful degradation when:
    # - No Google Ads account connected
    # - No campaigns exist
    # - No performance data available
    #
    class GoogleAdsMetric < BaseMetric
      # Generate CTR (Click-Through Rate) time series.
      #
      # @return [Hash] Time series with :available flag, :dates, :series, :totals
      #
      def ctr_time_series
        return unavailable_response("Connect Google Ads to see CTR data") unless ads_account?
        return unavailable_response("Create a campaign to see CTR data") unless campaigns_exist?
        return unavailable_response("No performance data available yet") unless performance_data?

        series = build_ctr_series
        totals = calculate_ctr_totals

        {
          available: true,
          dates: date_range_array,
          series: series,
          totals: totals,
          data_delay: "ads"
        }
      end

      # Generate CPL (Cost Per Lead) time series.
      #
      # @return [Hash] Time series with :available flag, :dates, :series, :totals
      #
      def cpl_time_series
        return unavailable_response("Connect Google Ads to see CPL data") unless ads_account?
        return unavailable_response("Create a campaign to see CPL data") unless campaigns_exist?
        return unavailable_response("No performance data available yet") unless performance_data?

        series = build_cpl_series
        totals = calculate_cpl_totals

        {
          available: true,
          dates: date_range_array,
          series: series,
          totals: totals,
          data_delay: "ads"
        }
      end

      private

      def unavailable_response(message)
        {
          available: false,
          message: message,
          dates: date_range_array,
          series: [],
          totals: { current: nil, previous: nil, trend_percent: 0, trend_direction: "flat" },
          data_delay: "ads"
        }
      end

      def ads_account?
        account.ads_account.present?
      end

      def campaigns_exist?
        account.campaigns.exists?
      end

      def performance_data?
        campaign_ids = account.campaigns.pluck(:id)
        AdPerformanceDaily
          .where(campaign_id: campaign_ids)
          .for_date_range(start_date, end_date)
          .exists?
      end

      def build_ctr_series
        # Aggregate by project (campaigns belong to projects)
        account.projects.includes(:campaigns).map do |project|
          campaign_ids = project.campaigns.pluck(:id)
          next nil if campaign_ids.empty?

          data = daily_ctr_for_campaigns(campaign_ids)
          {
            project_id: project.id,
            project_uuid: project.uuid,
            project_name: project.name,
            data: data
          }
        end.compact
      end

      def daily_ctr_for_campaigns(campaign_ids)
        # Get daily aggregated impressions and clicks
        daily_data = AdPerformanceDaily
          .where(campaign_id: campaign_ids)
          .for_date_range(start_date, end_date)
          .group(:date)
          .select("date, SUM(impressions) as impressions, SUM(clicks) as clicks")
          .index_by(&:date)

        (start_date..end_date).map do |date|
          record = daily_data[date]
          if record && record.impressions.to_i > 0
            (record.clicks.to_f / record.impressions).round(4)
          else
            0.0
          end
        end
      end

      def calculate_ctr_totals
        campaign_ids = account.campaigns.pluck(:id)

        current = AdPerformanceDaily
          .where(campaign_id: campaign_ids)
          .for_date_range(start_date, end_date)
          .select("SUM(impressions) as impressions, SUM(clicks) as clicks")
          .take

        current_ctr = if current&.impressions.to_i > 0
          (current.clicks.to_f / current.impressions).round(4)
        else
          0.0
        end

        prev_start, prev_end = previous_period_range
        previous = AdPerformanceDaily
          .where(campaign_id: campaign_ids)
          .for_date_range(prev_start, prev_end)
          .select("SUM(impressions) as impressions, SUM(clicks) as clicks")
          .take

        previous_ctr = if previous&.impressions.to_i > 0
          (previous.clicks.to_f / previous.impressions).round(4)
        else
          0.0
        end

        trend = calculate_trend(current_ctr, previous_ctr)

        {
          current: current_ctr,
          previous: previous_ctr,
          **trend
        }
      end

      def build_cpl_series
        account.projects.includes(:campaigns, website: :website_leads).map do |project|
          campaign_ids = project.campaigns.pluck(:id)
          next nil if campaign_ids.empty?

          data = daily_cpl_for_project(project, campaign_ids)
          {
            project_id: project.id,
            project_uuid: project.uuid,
            project_name: project.name,
            data: data
          }
        end.compact
      end

      def daily_cpl_for_project(project, campaign_ids)
        # Get daily costs
        daily_costs = AdPerformanceDaily
          .where(campaign_id: campaign_ids)
          .for_date_range(start_date, end_date)
          .group(:date)
          .sum(:cost_micros)

        # Get daily leads
        website = project.website
        daily_leads = if website
          WebsiteLead
            .where(website: website)
            .where(created_at: start_date.beginning_of_day..end_date.end_of_day)
            .group("DATE(created_at)")
            .count
        else
          {}
        end

        (start_date..end_date).map do |date|
          cost_micros = daily_costs[date] || 0
          leads = daily_leads[date] || 0

          if leads > 0 && cost_micros > 0
            (cost_micros / 1_000_000.0 / leads).round(2)
          else
            0.0
          end
        end
      end

      def calculate_cpl_totals
        campaign_ids = account.campaigns.pluck(:id)

        current_cost = AdPerformanceDaily
          .where(campaign_id: campaign_ids)
          .for_date_range(start_date, end_date)
          .sum(:cost_micros)

        current_leads = WebsiteLead
          .joins(website: :project)
          .where(projects: { account_id: account.id })
          .where(created_at: start_date.beginning_of_day..end_date.end_of_day)
          .count

        current_cpl = if current_leads > 0 && current_cost > 0
          (current_cost / 1_000_000.0 / current_leads).round(2)
        else
          0.0
        end

        prev_start, prev_end = previous_period_range

        previous_cost = AdPerformanceDaily
          .where(campaign_id: campaign_ids)
          .for_date_range(prev_start, prev_end)
          .sum(:cost_micros)

        previous_leads = WebsiteLead
          .joins(website: :project)
          .where(projects: { account_id: account.id })
          .where(created_at: prev_start.beginning_of_day..prev_end.end_of_day)
          .count

        previous_cpl = if previous_leads > 0 && previous_cost > 0
          (previous_cost / 1_000_000.0 / previous_leads).round(2)
        else
          0.0
        end

        # For CPL, lower is better, so invert trend direction
        trend = calculate_trend(current_cpl, previous_cpl)
        if trend[:trend_direction] == "up"
          trend[:trend_direction] = "down" # Higher CPL is bad
        elsif trend[:trend_direction] == "down"
          trend[:trend_direction] = "up" # Lower CPL is good
        end

        {
          current: current_cpl,
          previous: previous_cpl,
          **trend
        }
      end
    end
  end
end
