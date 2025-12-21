# Inertia Props Type Generation

## Overview

This skill covers how to add or modify Inertia page props that are passed from Rails to React, with full TypeScript type safety via OpenAPI spec generation.

## Architecture

1. **Ruby Schema Files** define the prop shapes
2. **Rake Task** generates OpenAPI YAML from Ruby schemas
3. **openapi-typescript** generates TypeScript types from YAML
4. **React Components** use the generated types via `usePage<Props>()`

## File Locations

### Ruby Schema Files

Located at `spec/support/schemas/inertia/`:

| File | Purpose |
|------|---------|
| `base_schemas.rb` | Shared props (root_path, jwt, flash, etc.) and helper methods |
| `brainstorm_schema.rb` | Props for `/projects/{uuid}/brainstorm` |
| `website_schema.rb` | Props for `/projects/{uuid}/website` |
| `campaigns_schema.rb` | Props for `/projects/{uuid}/campaigns/*` (content, highlights, keywords, settings, launch, review) |
| `launch_schema.rb` | Props for `/projects/{uuid}/launch/*` (extends campaigns, adds deployment) |

### Generated Files

| File | Generated From |
|------|----------------|
| `swagger/v1/inertia-props.yaml` | Ruby schemas via `rake inertia:generate_rswag` |
| `../shared/lib/api/generated/inertia-props.ts` | OpenAPI YAML via `rake inertia:generate_typescript` |

### Rake Task

`lib/tasks/inertia.rake` - Contains the `InertiaOpenApiGenerator` class and tasks.

### TypeScript Type Usage

```typescript
// In React components
import type { InertiaProps } from "@shared";

export type CampaignProps =
  InertiaProps.paths["/projects/{uuid}/campaigns/content"]["get"]["responses"]["200"]["content"]["application/json"];

// Usage
const { campaign, location_targets, ad_schedule } = usePage<CampaignProps>().props;
```

## Adding New Props

### Step 1: Update Ruby Schema

Edit the appropriate schema file in `spec/support/schemas/inertia/`:

```ruby
# Example: Adding daily_budget_cents to campaign in campaigns_schema.rb
campaign: InertiaSchemas.nullable(
  type: :object,
  additionalProperties: false,
  properties: {
    id: { type: :integer, description: 'Campaign ID' },
    name: { type: :string },
    daily_budget_cents: { type: :integer, nullable: true }  # NEW
  }
)
```

### Step 2: Update Rails Serializer

Ensure the data is actually returned. Check `app/models/concerns/project_concerns/serialization.rb`:

```ruby
# If adding to campaign, ensure it's merged in:
campaign: campaign.as_json.merge(daily_budget_cents: campaign.daily_budget_cents)
```

### Step 3: Regenerate Types

```bash
bundle exec rake inertia:generate
```

This runs both:
- `inertia:generate_rswag` - Ruby schemas → OpenAPI YAML
- `inertia:generate_typescript` - OpenAPI YAML → TypeScript

### Step 4: Use in React

```typescript
const { campaign } = usePage<CampaignProps>().props;
console.log(campaign?.daily_budget_cents); // Now typed!
```

## Schema Helpers

The `InertiaSchemas` module in `base_schemas.rb` provides:

```ruby
# Make a prop nullable
InertiaSchemas.nullable(type: :object, properties: { ... })

# Wrap page props with shared props (root_path, jwt, flash, etc.)
InertiaSchemas.with_shared_props(
  page_props: page_props,
  page_required: page_required
)
```

## Common Patterns

### Nested Object with Properties

```ruby
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
```

### Array of Objects

```ruby
location_targets: InertiaSchemas.nullable(
  type: :array,
  items: {
    type: :object,
    additionalProperties: false,
    properties: {
      target_type: { type: :string },
      targeted: { type: :boolean },
      geo_target_constant: { type: :string, nullable: true },
      location_name: { type: :string, nullable: true }
    }
  }
)
```

### Extending Another Schema

```ruby
# launch_schema.rb extends campaigns_schema.rb
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
```

## Troubleshooting

### Types not updating?

1. Ensure Ruby schema was saved
2. Run `bundle exec rake inertia:generate`
3. Check `swagger/v1/inertia-props.yaml` was updated
4. Check `../shared/lib/api/generated/inertia-props.ts` was updated

### Data not appearing in frontend?

1. Check the serialization method (e.g., `to_ad_campaign_json` in `serialization.rb`)
2. Ensure the model method or association exists
3. Check the controller is using the correct serialization method

### TypeScript errors?

The generated types use `additionalProperties: false`, so only explicitly defined properties are allowed. Add any missing properties to the Ruby schema.

## Related Files

- `app/controllers/projects_controller.rb` - Where props are passed to Inertia
- `app/models/concerns/project_concerns/serialization.rb` - JSON serialization methods
- `app/javascript/frontend/components/ads/sidebar/workflow-buddy/ad-campaign.types.ts` - Type aliases
