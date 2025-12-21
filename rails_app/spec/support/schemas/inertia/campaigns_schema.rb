# frozen_string_literal: true

module InertiaSchemas
  module Campaigns
    def self.page_props
      {
        thread_id: InertiaSchemas.nullable(type: :string, description: 'Langgraph thread ID for the conversation'),
        project: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer },
            uuid: { type: :string, description: 'Project UUID' },
            name: { type: :string },
            account_id: { type: :integer }
          }
        ),
        chat: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer },
            thread_id: { type: :string }
          }
        ),
        workflow: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer },
            step: { type: :string, nullable: true },
            substep: { type: :string, nullable: true, description: 'Current workflow substep' }
          }
        ),
        brainstorm: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer },
            name: { type: :string }
          }
        ),
        website: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer }
          }
        ),
        ads_account: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer }
          }
        ),
        campaign: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer, description: 'Campaign ID' },
            name: { type: :string },
            daily_budget_cents: { type: :integer, nullable: true }
          }
        ),
        ad_group: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer }
          }
        ),
        ad: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer }
          }
        ),
        headlines: InertiaSchemas.nullable(
          type: :array,
          items: {
            type: :object,
            additionalProperties: false,
            properties: {
              id: { type: :integer },
              text: { type: :string }
            }
          }
        ),
        descriptions: InertiaSchemas.nullable(
          type: :array,
          items: {
            type: :object,
            additionalProperties: false,
            properties: {
              id: { type: :integer },
              text: { type: :string }
            }
          }
        ),
        languages: InertiaSchemas.nullable(
          type: :array,
          items: { type: :object, additionalProperties: false }
        ),
        keywords: InertiaSchemas.nullable(
          type: :array,
          items: {
            type: :object,
            additionalProperties: false,
            properties: {
              id: { type: :integer },
              text: { type: :string }
            }
          }
        ),
        location_targets: InertiaSchemas.nullable(
          type: :array,
          items: {
            type: :object,
            additionalProperties: false,
            properties: {
              target_type: { type: :string },
              targeted: { type: :boolean },
              geo_target_constant: { type: :string, nullable: true },
              location_name: { type: :string, nullable: true },
              location_type: { type: :string, nullable: true },
              country_code: { type: :string, nullable: true },
              radius: { type: :number, nullable: true },
              radius_units: { type: :string, nullable: true }
            }
          }
        ),
        callouts: InertiaSchemas.nullable(
          type: :array,
          items: {
            type: :object,
            additionalProperties: false,
            properties: {
              id: { type: :integer },
              text: { type: :string }
            }
          }
        ),
        structured_snippet: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            category: { type: :string },
            values: { type: :array, items: { type: :string } }
          }
        ),
        ad_schedule: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            always_on: { type: :boolean },
            day_of_week: { type: :array, items: { type: :string } },
            start_time: { type: :string, nullable: true },
            end_time: { type: :string, nullable: true },
            time_zone: { type: :string }
          }
        )
      }
    end

    def self.page_required
      %w[]
    end

    def self.props_schema
      InertiaSchemas.with_shared_props(
        page_props: page_props,
        page_required: page_required
      )
    end

    module Content
      def self.props_schema
        InertiaSchemas::Campaigns.props_schema
      end
    end

    module Highlights
      def self.props_schema
        InertiaSchemas::Campaigns.props_schema
      end
    end

    module Keywords
      def self.props_schema
        InertiaSchemas::Campaigns.props_schema
      end
    end

    module Settings
      def self.props_schema
        InertiaSchemas::Campaigns.props_schema
      end
    end

    module Launch
      def self.props_schema
        InertiaSchemas::Campaigns.props_schema
      end
    end

    module Review
      def self.props_schema
        InertiaSchemas::Campaigns.props_schema
      end
    end
  end
end
