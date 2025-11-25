# Campaigns API - Working Documentation

## API Design Patterns

### Idempotent Updates via API

For API endpoints that need to handle autosave-style updates where the frontend sends complete state (not diffs), use the idempotent update pattern:

1. **Location**: Create concerns in `app/models/concerns/[model]_concerns/updating.rb` (following the same pattern as `creation.rb`)
2. **Method**: Define `update_idempotently!(update_params, raw_params)` in the concern
3. **Logic**: 
   - `update_params` contains sanitized params for regular Rails updates (with nested attributes removed)
   - `raw_params` contains the full unsanitized params for custom idempotent logic
   - Delete records not in the submitted array, update existing ones, create new ones
   - Wrap everything in a transaction
4. **Controller**: ALL API updates should use this pattern by default

**Example**: `CampaignConcerns::Updating` handles idempotent replacement of ad headlines and descriptions. The frontend sends complete arrays with monotonically increasing positions, and the backend syncs to that exact state.

### Implementation Details

#### Model Concern (`app/models/concerns/campaign_concerns/updating.rb`)

```ruby
module CampaignConcerns
  module Updating
    extend ActiveSupport::Concern

    def update_idempotently!(update_params, raw_params)
      transaction do
        update!(update_params)
        
        # Custom idempotent logic for nested attributes
        if raw_params[:ad_groups_attributes].present?
          raw_params[:ad_groups_attributes].each do |ad_group_attrs|
            # Process each ad group's ads
            # Delete records not in submitted array
            # Update existing records
            # Create new records
          end
        end
      end
    end
  end
end
```

#### Controller (`app/controllers/api/v1/campaigns_controller.rb`)

```ruby
def update
  campaign = current_campaign
  
  begin
    # Always use idempotent updates for API
    campaign.update_idempotently!(campaign_params_for_idempotent_update, campaign_params.to_h)
    
    # Handle special cases (location targets, ad schedules, etc.)
    handle_location_targets(campaign) if params.dig(:campaign, :location_targets).present?
    handle_ad_schedules(campaign) if params.dig(:campaign, :ad_schedules).present?
  rescue ActiveRecord::RecordInvalid => e
    render json: {errors: e.record.errors.full_messages}, status: :unprocessable_entity
  end
  
  render json: campaign_json(campaign)
end

private

def campaign_params_for_idempotent_update
  permitted = campaign_params.to_h
  
  # Remove nested attributes that will be handled idempotently
  permitted[:ad_groups_attributes]&.each do |ag_attrs|
    next unless ag_attrs[:ads_attributes]
    
    ag_attrs[:ads_attributes].each do |ad_attrs|
      ad_attrs.delete(:headlines_attributes)
      ad_attrs.delete(:descriptions_attributes)
    end
  end
  
  permitted
end
```

### Frontend Contract

The frontend should send **complete state** on each autosave:

```typescript
// Example: Updating headlines
{
  campaign: {
    ad_groups_attributes: [{
      id: 1,
      ads_attributes: [{
        id: 1,
        headlines_attributes: [
          { id: 2, text: "Updated Headline", position: 0 },  // Update existing
          { text: "New Headline", position: 1 }              // Create new
          // Headline with id: 1 will be deleted (not in array)
        ]
      }]
    }]
  }
}
```

**Rules**:
- Always send complete arrays (not diffs)
- Include `id` for records to keep/update
- Omit `id` for new records to create
- Don't send `_destroy` - omission implies deletion
- Use monotonically increasing `position` values (0, 1, 2, ...)

## Current Implementation Status

### Endpoints

- `POST /api/v1/campaigns` - Create campaign
- `PATCH /api/v1/campaigns/:id` - Update campaign (idempotent)
- `POST /api/v1/campaigns/:id/advance` - Advance to next stage
- `POST /api/v1/campaigns/:id/back` - Step back to previous stage

### Stage Validation

Each campaign stage has validation requirements before advancing:

- **content**: Requires 3+ headlines, 2+ descriptions
- **highlights**: TBD
- **targeting**: TBD
- **budget**: TBD
- **review**: TBD

Use `campaign.ready_for_next_stage?` to check if stage requirements are met.

## Completed Features

- [x] Add `ready_for_next_stage` flag to API response
- [x] Idempotent updates for headlines and descriptions
- [x] Stage advancement with validation
- [x] Back navigation between stages
- [x] Comprehensive test coverage (20 tests passing)

## TODO

- [ ] Implement stage validation for remaining stages (highlights, keywords, settings, launch)
- [ ] Document all stage requirements
- [ ] Add API schema definitions for Swagger docs
