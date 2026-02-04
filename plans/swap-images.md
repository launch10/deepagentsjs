# Plan: AgentContextEvent System for Swap Images

## Overview

Implement the "Swap Images" quick action using the **AgentContextEvent pattern** instead of direct intents. This is foundational infrastructure that will enable context-aware AI responses.

**Key difference from `change_theme`**: Instead of immediately triggering a graph handler, image uploads/deletes create context events that are consumed when the user next sends a message.

## Architecture

```
User uploads/deletes image via existing UI
        ↓
Rails model callback creates AgentContextEvent
        ↓
Event stored in database (project-scoped)
        ↓
User sends next message
        ↓
Context middleware fetches events since last AI response
        ↓
Events summarized → "[Context] I uploaded 3 images and deleted 1"
        ↓
Injected as HumanMessage before user's message
        ↓
Agent responds with awareness of image changes
```

## Implementation Steps

### Phase 1: Rails Foundation

#### 1.1 Create Migration
**File:** `rails_app/db/migrate/YYYYMMDDHHMMSS_create_agent_context_events.rb`

```ruby
class CreateAgentContextEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :agent_context_events do |t|
      t.bigint :account_id, null: false
      t.bigint :project_id  # nullable for account-level events
      t.bigint :user_id     # nullable for system events
      t.string :eventable_type
      t.bigint :eventable_id

      t.string :event_type, null: false
      t.jsonb :payload, default: {}

      t.timestamps
    end

    add_index :agent_context_events, :account_id
    add_index :agent_context_events, [:project_id, :created_at]
    add_index :agent_context_events, :event_type
    add_index :agent_context_events, [:eventable_type, :eventable_id]
  end
end
```

#### 1.2 Create Model
**File:** `rails_app/app/models/agent_context_event.rb`

- `acts_as_tenant :account`
- Validates `event_type` format: `resource.verb`
- MVP event types: `images.created`, `images.deleted`
- Scopes: `since(time)`, `for_project(id)`, `of_types(types)`, `chronological`

#### 1.3 Create TracksAgentContext Concern
**File:** `rails_app/app/models/concerns/tracks_agent_context.rb`

DSL for declaring context tracking:
```ruby
tracks_agent_context_on_create 'images.created', payload: ->(record) { ... }
tracks_agent_context_on_destroy 'images.deleted', payload: ->(record) { ... }
```

#### 1.4 Add Concern to WebsiteUpload
**File:** `rails_app/app/models/website_upload.rb`

```ruby
class WebsiteUpload < ApplicationRecord
  include TracksAgentContext

  belongs_to :website
  belongs_to :upload

  tracks_agent_context_on_create 'images.created',
    payload: ->(wu) { { upload_id: wu.upload.id, filename: wu.upload.original_filename, url: wu.upload.file.url } },
    if: ->(wu) { wu.upload.image? }

  tracks_agent_context_on_destroy 'images.deleted',
    payload: ->(wu) { { upload_id: wu.upload.id, filename: wu.upload.original_filename } },
    if: ->(wu) { wu.upload.image? }
end
```

#### 1.5 Create API Controller
**File:** `rails_app/app/controllers/api/v1/agent_context_events_controller.rb`

```ruby
GET /api/v1/agent_context_events
  params:
    - project_id (required)
    - event_types[] (optional)
    - since (optional, ISO8601 timestamp)
```

#### 1.6 Add Route
**File:** `rails_app/config/routes/api.rb`

```ruby
resources :agent_context_events, only: [:index]
```

### Phase 2: Langgraph Integration

#### 2.1 Create ContextEventsAPIService
**File:** `shared/lib/api/services/contextEventsAPIService.ts`

```typescript
interface ContextEvent {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

class ContextEventsAPIService extends RailsAPIBase {
  async list(params: { project_id: number; event_types?: string[]; since?: string }): Promise<ContextEvent[]>
}
```

#### 2.2 Create Agent Subscriptions
**File:** `langgraph_app/app/middleware/context/subscriptions.ts`

```typescript
export const AGENT_EVENT_SUBSCRIPTIONS = {
  website: ["images.created", "images.deleted"],
  brainstorm: [],
  ads: [],
};
```

#### 2.3 Create Event Summarization
**File:** `langgraph_app/app/middleware/context/summarization.ts`

- Group events by category (e.g., all `images.*` together)
- Produce single summary per category
- For images: "I uploaded 3 images and deleted 1" or "I uploaded hero.jpg, product.jpg"

#### 2.4 Create Context Engineering Middleware
**File:** `langgraph_app/app/middleware/context/contextEngineeringMiddleware.ts`

On `onStart`:
1. Get project_id from state
2. Find timestamp of last AI message
3. Fetch events from Rails API (filtered by subscriptions)
4. Summarize events
5. Build `[Context] ...` HumanMessages
6. Inject before user's current message

#### 2.5 Integrate Middleware
**File:** `langgraph_app/app/api/middleware/index.ts` (or `usageTracking.ts`)

Add `contextEngineeringMiddleware` to `createAppBridge`.

### Phase 3: No Frontend Changes Needed

The existing `useUploadProjectImage()` and `useDeleteUpload()` hooks already work. Events are created automatically via Rails callbacks.

## Files to Modify

| File | Action |
|------|--------|
| `rails_app/db/migrate/..._create_agent_context_events.rb` | Create |
| `rails_app/app/models/agent_context_event.rb` | Create |
| `rails_app/app/models/concerns/tracks_agent_context.rb` | Create |
| `rails_app/app/models/website_upload.rb` | Modify (add concern) |
| `rails_app/app/controllers/api/v1/agent_context_events_controller.rb` | Create |
| `rails_app/config/routes/api.rb` | Modify (add route) |
| `shared/lib/api/services/contextEventsAPIService.ts` | Create |
| `shared/lib/api/services/index.ts` | Modify (export service) |
| `langgraph_app/app/middleware/context/subscriptions.ts` | Create |
| `langgraph_app/app/middleware/context/summarization.ts` | Create |
| `langgraph_app/app/middleware/context/contextEngineeringMiddleware.ts` | Create |
| `langgraph_app/app/middleware/context/index.ts` | Create (barrel export) |
| `langgraph_app/app/api/middleware/index.ts` | Modify (add middleware) |

## Key Patterns from Codebase

- **Concerns pattern**: Follow `WebsiteConcerns::ThemeCssInjection` pattern with `included do` block
- **API routes**: Add to existing `namespace :api / namespace :v1` in `config/routes/api.rb`
- **Multi-tenancy**: Use `acts_as_tenant :account` like other models
- **Current attributes**: Use `Current.user` and `Current.account` for context

## Verification

1. **Rails console test**:
   ```ruby
   # Upload an image through the API
   wu = WebsiteUpload.create!(website: Website.first, upload: Upload.first)
   AgentContextEvent.last # Should see images.created event
   wu.destroy!
   AgentContextEvent.last # Should see images.deleted event
   ```

2. **API test**:
   ```bash
   curl -H "Authorization: Bearer $JWT" \
     "http://localhost:3000/api/v1/agent_context_events?project_id=1&event_types[]=images.created"
   ```

3. **E2E test**:
   - Upload images via QuickActions panel
   - Send a message in the chat
   - Verify agent response acknowledges the uploaded images

## Future Extensions

This infrastructure supports future event types:
- `theme.updated` (from Website model)
- `domain.assigned` / `domain.unassigned` (from Domain model)
- `keywords.created` / `keywords.deleted` (from AdKeyword model)
- `campaign.paused` / `campaign.resumed` (from Campaign model)
