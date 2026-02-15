# frozen_string_literal: true

module InertiaSchemas
  module Deploy
    def self.page_props
      InertiaSchemas::Campaigns.page_props.merge(
        chat: InertiaSchemas.always_null(description: 'Always null on deploy page'),
        deploy: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer, description: 'Deploy ID' },
            status: { type: :string, description: 'Deploy status' },
            current_step: { type: :string, nullable: true, description: 'Current deploy step' }
          }
        ),
        website_url: { type: :string, nullable: true, description: 'Published website URL' },
        deploy_environment: { type: :string, nullable: true, description: 'Deploy environment override (non-production only)' },
        ads_account: InertiaSchemas.nullable(
          type: :object,
          additionalProperties: false,
          properties: {
            id: { type: :integer },
            platform: { type: :string },
            platform_settings: InertiaSchemas.nullable(
              type: :object,
              properties: {
                google: InertiaSchemas.nullable(
                  type: :object,
                  properties: {
                    customer_id: { type: :string, nullable: true },
                    billing_status: { type: :string, nullable: true }
                  }
                )
              }
            )
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
  end
end
