# frozen_string_literal: true

module InertiaSchemas
  module Launch
    def self.page_props
      InertiaSchemas::Campaigns.page_props.merge(
        deployment: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer },
            status: { type: :string }
          }
        )
      )
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

    module Settings
      def self.props_schema
        InertiaSchemas::Launch.props_schema
      end
    end

    module Review
      def self.props_schema
        InertiaSchemas::Launch.props_schema
      end
    end

    module Deployment
      def self.props_schema
        InertiaSchemas::Launch.props_schema
      end
    end
  end
end
