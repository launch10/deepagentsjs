# frozen_string_literal: true

module APISchemas
  module DashboardInsight
    # Individual insight object schema
    def self.insight_schema
      {
        type: :object,
        properties: {
          title: { type: :string, description: "Short title (5 words max)" },
          description: { type: :string, description: "2-3 sentence explanation with specific numbers" },
          sentiment: {
            type: :string,
            enum: %w[positive negative neutral],
            description: "Sentiment of the insight"
          },
          project_uuid: {
            type: :string,
            nullable: true,
            description: "Project UUID if project-specific, null if account-wide"
          },
          action: {
            type: :object,
            properties: {
              label: { type: :string, description: "Button text" },
              url: { type: :string, description: "Action URL path" }
            },
            required: %w[label url]
          }
        },
        required: %w[title description sentiment action]
      }
    end

    # Response schema for GET /api/v1/dashboard_insights
    def self.index_response
      {
        type: :object,
        properties: {
          id: {
            oneOf: [
              APISchemas.id_field,
              { type: :null }
            ],
            description: "Insight record ID (null if none exists)"
          },
          insights: {
            oneOf: [
              { type: :array, items: insight_schema },
              { type: :null }
            ],
            description: "Array of 3 insights (null if none exists)"
          },
          generated_at: {
            oneOf: [
              APISchemas.timestamp_field,
              { type: :null }
            ],
            description: "When insights were generated (null if none exists)"
          },
          fresh: {
            type: :boolean,
            description: "Whether insights are still fresh (< 24 hours old)"
          },
          metrics_summary: {
            oneOf: [
              { type: :object, additionalProperties: true },
              { type: :null }
            ],
            description: "The metrics used to generate insights"
          }
        },
        required: %w[id insights generated_at fresh]
      }
    end

    # Response schema for POST /api/v1/dashboard_insights
    def self.create_response
      {
        type: :object,
        properties: {
          id: APISchemas.id_field,
          insights: {
            type: :array,
            items: insight_schema,
            minItems: 3,
            maxItems: 3,
            description: "Array of exactly 3 insights"
          },
          generated_at: APISchemas.timestamp_field,
          fresh: {
            type: :boolean,
            description: "Whether insights are still fresh (always true after creation)"
          },
          metrics_summary: {
            type: :object,
            additionalProperties: true,
            description: "The metrics used to generate insights"
          }
        },
        required: %w[id insights generated_at fresh]
      }
    end

    # Request schema for POST /api/v1/dashboard_insights
    def self.create_params_schema
      {
        type: :object,
        properties: {
          dashboard_insight: {
            type: :object,
            properties: {
              insights: {
                type: :array,
                items: insight_schema,
                minItems: 3,
                maxItems: 3,
                description: "Array of exactly 3 insights to save"
              },
              metrics_summary: {
                type: :object,
                additionalProperties: true,
                description: "Optional metrics summary used for generation"
              }
            },
            required: %w[insights]
          }
        },
        required: %w[dashboard_insight]
      }
    end

    # Trend schema for reuse
    def self.trend_schema
      {
        type: :object,
        properties: {
          direction: { type: :string, enum: %w[up down flat] },
          percent: { type: :number }
        },
        required: %w[direction percent]
      }
    end

    # Metrics summary response schema
    def self.metrics_summary_response
      {
        type: :object,
        properties: {
          period: { type: :string, description: "Time period for metrics" },
          totals: {
            type: :object,
            properties: {
              leads: { type: :integer },
              page_views: { type: :integer },
              ctr: { type: :number, nullable: true },
              cpl: { type: :number, nullable: true },
              ctr_available: { type: :boolean },
              cpl_available: { type: :boolean },
              total_spend_dollars: { type: :number, nullable: true }
            },
            required: %w[leads page_views ctr_available cpl_available]
          },
          projects: {
            type: :array,
            items: {
              type: :object,
              properties: {
                uuid: { type: :string },
                name: { type: :string },
                total_leads: { type: :integer },
                total_page_views: { type: :integer },
                ctr: { type: :number, nullable: true },
                cpl: { type: :number, nullable: true },
                days_since_last_lead: { type: :integer, nullable: true },
                spend_dollars: { type: :number, nullable: true }
              },
              required: %w[uuid name total_leads total_page_views]
            }
          },
          trends: {
            type: :object,
            properties: {
              leads_trend: trend_schema,
              page_views_trend: trend_schema,
              ctr_trend: {
                oneOf: [
                  trend_schema,
                  { type: :null }
                ]
              },
              cpl_trend: {
                oneOf: [
                  trend_schema,
                  { type: :null }
                ]
              }
            }
          },
          flags: {
            type: :object,
            properties: {
              has_stalled_project: { type: :boolean },
              has_high_performer: { type: :boolean },
              has_new_first_lead: { type: :boolean }
            }
          }
        },
        required: %w[period totals projects trends]
      }
    end
  end
end
