# frozen_string_literal: true

module InertiaSchemas
  module Performance
    extend self

    def page_props
      {
        project: project_schema,
        metrics: metrics_by_days_schema,
        date_range_options: date_range_options_schema
      }
    end

    def page_required
      %w[project metrics date_range_options]
    end

    def props_schema
      InertiaSchemas.with_shared_props(
        page_props: page_props,
        page_required: page_required
      )
    end

    private

    def project_schema
      {
        type: :object,
        required: %w[id uuid name],
        properties: {
          id: InertiaSchemas.integer_field(description: "Project ID"),
          uuid: InertiaSchemas.string_field(description: "Project UUID"),
          name: InertiaSchemas.string_field(description: "Project name"),
          website_id: InertiaSchemas.nullable(InertiaSchemas.integer_field),
          account_id: InertiaSchemas.integer_field,
          created_at: InertiaSchemas.string_field,
          updated_at: InertiaSchemas.string_field
        }
      }
    end

    def metrics_by_days_schema
      # Keyed by days string: "7", "30", "90", "0"
      {
        type: :object,
        additionalProperties: metrics_schema
      }
    end

    def metrics_schema
      {
        type: :object,
        required: %w[summary impressions clicks ctr has_data],
        properties: {
          summary: summary_schema,
          impressions: time_series_schema,
          clicks: time_series_schema,
          ctr: time_series_schema,
          has_data: InertiaSchemas.boolean_field
        }
      }
    end

    def summary_schema
      {
        type: :object,
        required: %w[ad_spend leads],
        properties: {
          ad_spend: { type: :number },
          ad_spend_trend: trend_schema,
          leads: { type: :integer },
          leads_trend: trend_schema,
          cpl: InertiaSchemas.nullable({ type: :number }),
          cpl_trend: trend_schema,
          roas: InertiaSchemas.nullable({ type: :number }),
          roas_trend: trend_schema
        }
      }
    end

    def trend_schema
      {
        type: :object,
        required: %w[direction percent],
        properties: {
          direction: { type: :string, enum: %w[up down flat] },
          percent: { type: :number }
        }
      }
    end

    def time_series_schema
      {
        type: :object,
        required: %w[dates data totals data_delay],
        properties: {
          dates: { type: :array, items: { type: :string } },
          data: { type: :array, items: { type: :number } },
          totals: totals_schema,
          data_delay: { type: :string, enum: %w[realtime ads], description: "Data freshness: realtime (15 min) or ads (2-4 hours)" }
        }
      }
    end

    def totals_schema
      {
        type: :object,
        required: %w[current previous trend_percent trend_direction],
        properties: {
          current: { type: :number },
          previous: { type: :number },
          trend_percent: { type: :number },
          trend_direction: { type: :string, enum: %w[up down flat] }
        }
      }
    end

    def date_range_options_schema
      {
        type: :array,
        items: {
          type: :object,
          required: %w[days label],
          properties: {
            days: { type: :integer },
            label: { type: :string }
          }
        }
      }
    end
  end
end
