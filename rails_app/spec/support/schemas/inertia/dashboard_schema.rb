# frozen_string_literal: true

module InertiaSchemas
  module Dashboard
    def self.series_data_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          project_id: InertiaSchemas.integer_field(description: 'Project ID'),
          project_uuid: InertiaSchemas.string_field(description: 'Project UUID'),
          project_name: InertiaSchemas.string_field(description: 'Project name'),
          data: {
            type: :array,
            items: { type: :number },
            description: 'Daily metric values for each date in range'
          }
        },
        required: %w[project_id project_uuid project_name data]
      }
    end

    def self.totals_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          current: { type: :number, description: 'Total for current period' },
          previous: { type: :number, description: 'Total for previous period' },
          trend_percent: { type: :number, description: 'Percentage change from previous period' },
          trend_direction: {
            type: :string,
            enum: %w[up down flat],
            description: 'Direction of the trend'
          }
        },
        required: %w[current previous trend_percent trend_direction]
      }
    end

    def self.time_series_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          dates: {
            type: :array,
            items: { type: :string },
            description: 'ISO formatted dates for x-axis'
          },
          series: {
            type: :array,
            items: series_data_props,
            description: 'Metric values per project'
          },
          totals: totals_props,
          data_delay: {
            type: :string,
            enum: %w[realtime ads],
            description: 'Data freshness: realtime (15 min) or ads (2-4 hours)'
          }
        },
        required: %w[dates series totals data_delay]
      }
    end

    def self.performance_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          leads: time_series_props,
          unique_visitors: time_series_props,
          page_views: time_series_props,
          ctr: time_series_props,
          cpl: time_series_props
        },
        required: %w[leads unique_visitors page_views ctr cpl]
      }
    end

    def self.project_summary_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          id: InertiaSchemas.integer_field(description: 'Project ID'),
          uuid: InertiaSchemas.string_field(description: 'Project UUID'),
          name: InertiaSchemas.string_field(description: 'Project name'),
          status: {
            type: :string,
            enum: %w[live paused draft],
            description: 'Project status derived from campaign states'
          },
          url: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Published site URL')),
          thumbnail_url: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Preview thumbnail URL')),
          total_leads: InertiaSchemas.integer_field(description: 'Total leads for period'),
          total_unique_visitors: InertiaSchemas.integer_field(description: 'Total unique visitors'),
          total_page_views: InertiaSchemas.integer_field(description: 'Total page views'),
          total_impressions: InertiaSchemas.integer_field(description: 'Total ad impressions'),
          total_clicks: InertiaSchemas.integer_field(description: 'Total ad clicks'),
          ctr: InertiaSchemas.nullable({ type: :number, description: 'Click-through rate' }),
          cost_dollars: { type: :number, description: 'Total ad spend in dollars' },
          cpl: InertiaSchemas.nullable({ type: :number, description: 'Cost per lead' })
        },
        required: %w[id uuid name status total_leads total_unique_visitors total_page_views
          total_impressions total_clicks cost_dollars]
      }
    end

    def self.status_counts_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          all: InertiaSchemas.integer_field(description: 'Total projects count'),
          live: InertiaSchemas.integer_field(description: 'Live projects count'),
          paused: InertiaSchemas.integer_field(description: 'Paused projects count'),
          draft: InertiaSchemas.integer_field(description: 'Draft projects count')
        },
        required: %w[all live paused draft]
      }
    end

    def self.date_range_option_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          label: InertiaSchemas.string_field(description: 'Display label'),
          days: InertiaSchemas.integer_field(description: 'Number of days')
        },
        required: %w[label days]
      }
    end

    def self.insight_action_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          label: InertiaSchemas.string_field(description: 'Action button label'),
          url: InertiaSchemas.string_field(description: 'Action URL')
        },
        required: %w[label url]
      }
    end

    def self.insight_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          title: InertiaSchemas.string_field(description: 'Insight title'),
          description: InertiaSchemas.string_field(description: 'Insight description'),
          sentiment: {
            type: :string,
            enum: %w[positive negative neutral],
            description: 'Insight sentiment'
          },
          project_uuid: InertiaSchemas.nullable(InertiaSchemas.string_field(description: 'Related project UUID')),
          action: insight_action_props
        },
        required: %w[title description sentiment action]
      }
    end

    # Performance data keyed by days (7, 30, 90)
    def self.all_performance_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          "7": performance_props,
          "30": performance_props,
          "90": performance_props
        },
        required: %w[7 30 90]
      }
    end

    # Projects data keyed by days (7, 30, 90)
    def self.all_projects_props
      {
        type: :object,
        additionalProperties: false,
        properties: {
          "7": {
            type: :array,
            items: project_summary_props,
            description: 'Project summaries for 7-day range'
          },
          "30": {
            type: :array,
            items: project_summary_props,
            description: 'Project summaries for 30-day range'
          },
          "90": {
            type: :array,
            items: project_summary_props,
            description: 'Project summaries for 90-day range'
          }
        },
        required: %w[7 30 90]
      }
    end

    def self.page_props
      {
        all_performance: all_performance_props,
        all_projects: all_projects_props,
        status_counts: status_counts_props,
        date_range_options: {
          type: :array,
          items: date_range_option_props,
          description: 'Available date range options'
        },
        insights: InertiaSchemas.nullable(
          type: :array,
          items: insight_props,
          description: 'AI-generated insights (null if stale)'
        ),
        metrics_summary: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: true,
          description: 'Metrics summary for insight generation'
        ),
        thread_id: InertiaSchemas.string_field(description: 'Thread ID for Langgraph insights generation')
      }
    end

    def self.page_required
      %w[all_performance all_projects status_counts date_range_options thread_id]
    end

    def self.props_schema
      InertiaSchemas.with_shared_props(
        page_props: page_props,
        page_required: page_required
      )
    end
  end
end
