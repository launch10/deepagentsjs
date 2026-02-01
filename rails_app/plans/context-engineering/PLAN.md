# Launch10 Agent Context Architecture: Middleware-First Design

## The Vision

Launch10 is a hybrid SAAS/AI app where users move between traditional UI pages and AI agent conversations. The challenge: **agents need to know what the user is doing, why they're there, and what's changed** - without manually wiring every page.

**Key insight:** All context engineering happens in a single middleware layer. Events are recorded automatically via model callbacks. This creates a coherent timeline that any agent can understand.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RAILS MODELS                                 │
│  • Model callbacks automatically create AgentContextEvents          │
│  • No manual event recording needed                                  │
│  • Consistent resource.verb naming (theme.updated, images.created)  │
│  • Events are PROJECT-SCOPED (not thread-scoped)                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTEXT MIDDLEWARE                                │
│  Wraps every graph via createAppBridge                               │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 1. Get last AI message timestamp for this conversation         │  │
│  │ 2. Fetch project events since (filtered by agent subscription) │  │
│  │ 3. Merge consecutive similar events                            │  │
│  │ 4. Consume intent from state (if present)                      │  │
│  │ 5. Build context messages IN ORDER of occurrence               │  │
│  │ 6. Inject as HumanMessages before current user message         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  SummarizationMiddleware (existing) handles long conversations       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ANY GRAPH (website, ads, brainstorm)            │
│  • Receives pre-built message history                                │
│  • Doesn't need to know about context engineering                    │
│  • Just does its job                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What The Agent Sees

```
HumanMessage: "Let's build my website"
AIMessage: "<website output>"

// === Context events (project changes since last AI response) ===
HumanMessage: "[Context] I experimented with themes and settled on Seafoam Green"
HumanMessage: "[Context] I uploaded 3 images: hero-dog.jpg, product-1.jpg, product-2.jpg"
HumanMessage: "[Context] I assigned the domain pawportraits.launch10.site"

// === Current user message ===
HumanMessage: "Can we make a more compelling CTA?"
```

---

## Two Layers

| Layer                 | Scope             | Lifecycle                | Storage     |
| --------------------- | ----------------- | ------------------------ | ----------- |
| **AgentContextEvent** | Project           | Persistent, accumulated  | Rails DB    |
| **Intent**            | Navigation moment | Ephemeral, consumed once | State field |

**AgentContextEvents** are facts about what happened to a project. User uploads images? Project event. User changes theme? Project event. These persist and any agent conversation about that project can see them.

**Intents** are ephemeral "why I'm here" signals. User clicks an insight and navigates to website builder? That's an intent - consumed once when the agent picks it up.

---

## Event Naming Convention

### Verbs (Exhaustive List)

| Verb         | When to Use                                |
| ------------ | ------------------------------------------ |
| `created`    | New record inserted                        |
| `updated`    | Existing record modified                   |
| `deleted`    | Record removed                             |
| `assigned`   | Association/value set (domain, URL, owner) |
| `unassigned` | Association/value cleared                  |
| `completed`  | Task/topic finished                        |
| `paused`     | Temporarily stopped                        |
| `resumed`    | Restarted after pause                      |
| `visited`    | Page navigation                            |

### Event Types

```ruby
# Format: resource.verb
VALID_EVENT_TYPES = %w[
  # Website
  theme.updated
  images.created
  images.deleted
  domain.assigned
  domain.unassigned
  website.deployed

  # Brainstorm
  topic.completed
  brand_voice.updated
  logo.created
  colors.updated

  # Ads
  keywords.updated
  headlines.updated
  descriptions.updated
  budget.updated
  campaign.paused
  campaign.resumed

  # Navigation
  page.visited
].freeze
```

---

## Layer 1: AgentContextEvent (Rails)

### Model

```ruby
# app/models/agent_context_event.rb
class AgentContextEvent < ApplicationRecord
  acts_as_paranoid
  acts_as_tenant :account

  belongs_to :project  # Events are always project-scoped
  belongs_to :user
  belongs_to :eventable, polymorphic: true, optional: true

  # Consistent resource.verb format
  VALID_VERBS = %w[created updated deleted assigned unassigned completed paused resumed visited].freeze

  validates :event_type, presence: true, format: {
    with: /\A[a-z_]+\.(#{VALID_VERBS.join('|')})\z/,
    message: "must be in format 'resource.verb' with valid verb"
  }
  validates :project, presence: true

  scope :since, ->(time) { where('created_at > ?', time) }
  scope :for_project, ->(project_id) { where(project_id: project_id) }
  scope :of_types, ->(types) { where(event_type: types) }
  scope :chronological, -> { order(created_at: :asc) }

  # Human-readable message for the agent
  def to_agent_message
    FORMATTERS[event_type]&.call(payload) || "#{event_type}: #{payload.to_json}"
  end

  private

  FORMATTERS = {
    'theme.updated' => ->(p) {
      if p['experimented']
        "I experimented with #{p['changes_count']} themes and settled on #{p['theme_name'] || 'one I liked'}"
      else
        "I changed the color theme#{p['theme_name'] ? " to #{p['theme_name']}" : ''}"
      end
    },
    'images.created' => ->(p) {
      names = p['filenames']&.first(5)&.join(', ') || "#{p['count']} images"
      suffix = (p['count'] || 0) > 5 ? " and #{p['count'] - 5} more" : ''
      "I uploaded images: #{names}#{suffix}"
    },
    'images.deleted' => ->(p) { "I removed the image: #{p['filename']}" },
    'domain.assigned' => ->(p) { "I assigned the domain #{p['domain']}" },
    'domain.unassigned' => ->(p) { "I removed the domain assignment" },
    'website.deployed' => ->(p) { "My site was deployed#{p['url'] ? " at #{p['url']}" : ''}" },
    'topic.completed' => ->(p) { "I completed the \"#{p['topic']}\" section" },
    'brand_voice.updated' => ->(p) { "I set my brand voice to: #{p['voice']}" },
    'logo.created' => ->(_p) { "I uploaded my logo" },
    'colors.updated' => ->(_p) { "I selected my brand colors" },
    'keywords.updated' => ->(p) {
      parts = []
      parts << "added: #{p['added'].first(5).join(', ')}" if p['added']&.any?
      parts << "removed: #{p['removed'].first(5).join(', ')}" if p['removed']&.any?
      "I edited keywords (#{parts.join('; ')})"
    },
    'headlines.updated' => ->(_p) { "I edited ad headlines" },
    'descriptions.updated' => ->(_p) { "I edited ad descriptions" },
    'budget.updated' => ->(p) { "I changed the daily budget to $#{p['amount']}" },
    'campaign.paused' => ->(_p) { "I paused the campaign" },
    'campaign.resumed' => ->(_p) { "I resumed the campaign" },
    'page.visited' => ->(p) { "I navigated to the #{p['page_name']} page" },
  }.freeze
end
```

### Migration

```ruby
# db/migrate/XXXXXX_create_agent_context_events.rb
class CreateAgentContextEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :agent_context_events do |t|
      t.references :account, null: false, foreign_key: true
      t.references :project, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.references :eventable, polymorphic: true

      t.string :event_type, null: false  # e.g., 'theme.updated', 'images.created'
      t.jsonb :payload, default: {}

      t.timestamps
      t.datetime :deleted_at
    end

    add_index :agent_context_events, [:project_id, :created_at]
    add_index :agent_context_events, [:project_id, :event_type]
    add_index :agent_context_events, :event_type
    add_index :agent_context_events, :deleted_at
  end
end
```

---

## Layer 2: Model Callbacks (Concern)

```ruby
# app/models/concerns/tracks_agent_context.rb
module TracksAgentContext
  extend ActiveSupport::Concern

  class_methods do
    # Declare which events to track and how to build the payload
    #
    # Example:
    #   tracks_agent_context :updated,
    #     event_type: 'theme.updated',
    #     payload: ->(record) { { theme_id: record.id, theme_name: record.name } },
    #     if: ->(record) { record.saved_change_to_theme_id? }
    #
    def tracks_agent_context(callback_type, event_type:, payload: nil, if: nil, unless: nil)
      callback_method = :"after_#{callback_type}"

      send(callback_method, **{ if: binding.local_variable_get(:if), unless: unless }.compact) do
        create_agent_context_event(event_type, payload)
      end
    end

    # Shorthand for common patterns
    def tracks_agent_context_on_create(event_type, payload: nil, **options)
      tracks_agent_context(:create, event_type: event_type, payload: payload, **options)
    end

    def tracks_agent_context_on_update(event_type, payload: nil, **options)
      tracks_agent_context(:commit, event_type: event_type, payload: payload, **options)
    end

    def tracks_agent_context_on_destroy(event_type, payload: nil, **options)
      tracks_agent_context(:destroy, event_type: event_type, payload: payload, **options)
    end
  end

  private

  def create_agent_context_event(event_type, payload_proc)
    project = find_project
    return unless project # Events require a project

    payload_data = payload_proc.is_a?(Proc) ? payload_proc.call(self) : (payload_proc || {})

    AgentContextEvent.create!(
      account: project.account,
      user: Current.user || (respond_to?(:user) ? user : nil),
      project: project,
      event_type: event_type,
      eventable: self,
      payload: payload_data
    )
  rescue => e
    Rails.logger.error("[TracksAgentContext] Failed to create context event: #{e.message}")
    # Don't raise - context tracking shouldn't break the main operation
  end

  def find_project
    return project if respond_to?(:project) && project.present?
    return website.project if respond_to?(:website) && website&.project.present?
    return campaign.project if respond_to?(:campaign) && campaign&.project.present?
    return ad_group.campaign.project if respond_to?(:ad_group) && ad_group&.campaign&.project.present?
    nil
  end
end
```

---

## Layer 3: Model Integration Examples

### Website (Theme Updates)

```ruby
# app/models/website.rb
class Website < ApplicationRecord
  include TracksAgentContext

  belongs_to :project
  belongs_to :theme, optional: true

  tracks_agent_context_on_update 'theme.updated',
    payload: ->(w) { { theme_id: w.theme_id, theme_name: w.theme&.name } },
    if: ->(w) { w.saved_change_to_theme_id? }
end
```

### Upload (Images Created/Deleted)

```ruby
# app/models/upload.rb
class Upload < ApplicationRecord
  include TracksAgentContext

  belongs_to :project

  tracks_agent_context_on_create 'images.created',
    payload: ->(u) { { filename: u.filename, url: u.url } },
    if: ->(u) { u.image? }

  tracks_agent_context_on_destroy 'images.deleted',
    payload: ->(u) { { filename: u.filename } },
    if: ->(u) { u.image? }
end
```

### Domain Assignment

```ruby
# app/models/domain.rb
class Domain < ApplicationRecord
  include TracksAgentContext

  belongs_to :website

  tracks_agent_context_on_create 'domain.assigned',
    payload: ->(d) { { domain: d.full_domain } }

  tracks_agent_context_on_destroy 'domain.unassigned',
    payload: ->(d) { { domain: d.full_domain } }
end
```

### Ad Keywords (Batched)

```ruby
# app/services/ad_keyword_service.rb
class AdKeywordService
  def bulk_update(ad_group, added:, removed:)
    project = ad_group.campaign.project

    ActiveRecord::Base.transaction do
      removed_texts = AdKeyword.where(id: removed).pluck(:text)
      AdKeyword.where(id: removed).destroy_all
      added.each { |kw| ad_group.keywords.create!(text: kw) }

      # Single context event for the batch
      AgentContextEvent.create!(
        account: project.account,
        user: Current.user,
        project: project,
        event_type: 'keywords.updated',
        eventable: ad_group,
        payload: { added: added, removed: removed_texts }
      )
    end
  end
end
```

### Campaign State

```ruby
# app/models/campaign.rb
class Campaign < ApplicationRecord
  include TracksAgentContext

  belongs_to :project

  tracks_agent_context_on_update 'campaign.paused',
    if: ->(c) { c.saved_change_to_status? && c.status == 'paused' }

  tracks_agent_context_on_update 'campaign.resumed',
    if: ->(c) { c.saved_change_to_status? && c.status_previously_was == 'paused' && c.status == 'active' }

  tracks_agent_context_on_update 'budget.updated',
    payload: ->(c) { { amount: c.daily_budget } },
    if: ->(c) { c.saved_change_to_daily_budget? }
end
```

---

## Layer 4: Page Navigation (Frontend)

Page navigation is tracked from the frontend since it's a UI concern.

```typescript
// frontend/hooks/usePageNavigation.ts
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@api/client";
import { useProject } from "@hooks/useProject";

const PAGE_NAMES: Record<string, string> = {
  "/brainstorm": "Brainstorm",
  "/website": "Website Builder",
  "/website/deploy": "Deploy",
  "/ads": "Ads Builder",
  "/ads/keywords": "Keywords",
  "/ads/content": "Ad Content",
  "/dashboard": "Dashboard",
};

export function usePageNavigation() {
  const location = useLocation();
  const { project } = useProject();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (location.pathname === lastPath.current || !project) return;
    lastPath.current = location.pathname;

    const pageName = PAGE_NAMES[location.pathname];
    if (!pageName) return;

    api.post("/api/v1/agent_context_events", {
      event_type: "page.visited",
      project_id: project.id,
      payload: { page_name: pageName, path: location.pathname },
    });
  }, [location.pathname, project]);
}
```

### API Controller

```ruby
# app/controllers/api/v1/agent_context_events_controller.rb
class Api::V1::AgentContextEventsController < Api::BaseController
  # GET /api/v1/agent_context_events
  # Called by Langgraph middleware to fetch context
  def index
    events = current_account.agent_context_events
      .for_project(params[:project_id])

    events = events.of_types(params[:event_types]) if params[:event_types]
    events = events.since(params[:since]) if params[:since]

    render json: events.chronological.limit(100).map { |e|
      {
        id: e.id,
        event_type: e.event_type,
        payload: e.payload,
        created_at: e.created_at,
        message: e.to_agent_message
      }
    }
  end

  # POST /api/v1/agent_context_events
  # Only for frontend-initiated events (page.visited)
  def create
    unless params[:event_type] == 'page.visited'
      return render json: { error: 'Event type not allowed from frontend' }, status: :forbidden
    end

    project = current_account.projects.find(params[:project_id])

    event = AgentContextEvent.new(
      account: current_account,
      project: project,
      user: current_user,
      event_type: params[:event_type],
      payload: params[:payload] || {}
    )

    if event.save
      render json: { id: event.id }, status: :created
    else
      render json: { errors: event.errors.full_messages }, status: :unprocessable_entity
    end
  end
end
```

---

## Layer 5: Intent (Ephemeral Navigation Context)

Intents are "why I navigated here" - consumed once when the agent picks them up.

```typescript
// shared/state/core.ts - add to CoreAnnotation
intent: Annotation<AgentIntent | undefined>({
  default: () => undefined,
  reducer: (_, next) => next,
}),
```

```typescript
// shared/types/intent.ts
export interface AgentIntent {
  type: string; // 'address-insight', 'edit-section', 'quick-action'
  payload: Record<string, unknown>;
  createdAt: string;
}
```

```typescript
// frontend/lib/intent.ts
const INTENT_KEY = "launch10_pending_intent";

export function stashIntent(intent: Omit<AgentIntent, "createdAt">): void {
  localStorage.setItem(
    INTENT_KEY,
    JSON.stringify({
      ...intent,
      createdAt: new Date().toISOString(),
    })
  );
}

export function consumeIntent(): AgentIntent | null {
  const raw = localStorage.getItem(INTENT_KEY);
  if (!raw) return null;
  localStorage.removeItem(INTENT_KEY);

  const intent = JSON.parse(raw);
  if (Date.now() - new Date(intent.createdAt).getTime() > 5 * 60 * 1000) {
    return null;
  }
  return intent;
}
```

### Intent Usage (Dashboard → Website)

```typescript
// Dashboard insight card
function InsightCard({ insight }) {
  const handleClick = () => {
    stashIntent({
      type: 'address-insight',
      payload: {
        insight_title: insight.title,
        insight_description: insight.description,
      },
    });
    router.visit('/website');
  };

  return <button onClick={handleClick}>...</button>;
}

// Website page picks up intent and passes to graph
function WebsitePage() {
  const { sendMessage } = useWebsiteChat();

  useEffect(() => {
    const intent = consumeIntent();
    if (intent) {
      sendMessage('', { intent });
    }
  }, []);
}
```

---

## Layer 6: Langgraph Middleware

### Agent Subscriptions

```typescript
// langgraph_app/app/middleware/context/subscriptions.ts

/**
 * Each agent opts into event types it cares about.
 * Format: resource.verb
 */
export const AGENT_EVENT_SUBSCRIPTIONS: Record<string, string[]> = {
  website: [
    "theme.updated",
    "images.created",
    "images.deleted",
    "domain.assigned",
    "domain.unassigned",
    "website.deployed",
    "page.visited",
  ],
  brainstorm: [
    "topic.completed",
    "brand_voice.updated",
    "logo.created",
    "colors.updated",
    "page.visited",
  ],
  ads: [
    "keywords.updated",
    "headlines.updated",
    "descriptions.updated",
    "budget.updated",
    "campaign.paused",
    "campaign.resumed",
    "page.visited",
  ],
};
```

### Event Merging

```typescript
// langgraph_app/app/middleware/context/merging.ts

interface ContextEvent {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  message: string; // Pre-formatted by Rails
}

interface MergedEvent {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  message: string;
  merged_count: number;
}

/**
 * Merge consecutive events of the same type.
 */
export function mergeConsecutiveEvents(events: ContextEvent[]): MergedEvent[] {
  if (events.length === 0) return [];

  const merged: MergedEvent[] = [];
  let current: MergedEvent | null = null;

  for (const event of events) {
    if (current && canMerge(current, event)) {
      current = mergeInto(current, event);
    } else {
      if (current) merged.push(current);
      current = { ...event, merged_count: 1 };
    }
  }

  if (current) merged.push(current);
  return merged;
}

function canMerge(a: MergedEvent, b: ContextEvent): boolean {
  if (a.event_type !== b.event_type) return false;

  // Within 10 minutes
  const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  return timeDiff <= 10 * 60 * 1000;
}

function mergeInto(existing: MergedEvent, incoming: ContextEvent): MergedEvent {
  const merged_count = existing.merged_count + 1;

  switch (existing.event_type) {
    case "theme.updated":
      return {
        ...incoming,
        payload: { ...incoming.payload, experimented: true, changes_count: merged_count },
        message: `I experimented with ${merged_count} themes and settled on ${incoming.payload.theme_name || "one I liked"}`,
        merged_count,
      };

    case "images.created":
      const existingFiles = (existing.payload.filenames as string[]) || [existing.payload.filename];
      const newFiles = [incoming.payload.filename].filter(Boolean);
      const allFiles = [...existingFiles, ...newFiles].filter(Boolean) as string[];
      return {
        event_type: "images.created",
        payload: { filenames: allFiles, count: allFiles.length },
        created_at: incoming.created_at,
        message: `I uploaded ${allFiles.length} images: ${allFiles.slice(0, 5).join(", ")}${allFiles.length > 5 ? ` and ${allFiles.length - 5} more` : ""}`,
        merged_count,
      };

    case "page.visited":
      // Keep only final destination
      return { ...incoming, merged_count };

    default:
      return { ...incoming, merged_count };
  }
}
```

### Stream Middleware

```typescript
// langgraph_app/app/middleware/context/contextEngineeringMiddleware.ts

import { type StreamMiddleware } from "langgraph-ai-sdk";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AGENT_EVENT_SUBSCRIPTIONS } from "./subscriptions";
import { mergeConsecutiveEvents } from "./merging";
import { RailsAPI } from "@rails_api";

const INTENT_FORMATTERS: Record<string, (p: any) => string> = {
  "address-insight": (p) =>
    `I saw this insight on my dashboard: "${p.insight_title}" - ${p.insight_description}. I want to address it.`,
  "edit-section": (p) => `I want to edit the ${p.section_name} section of my website`,
  "quick-action": (p) => `I want to ${p.action_description}`,
};

export const contextEngineeringMiddleware: StreamMiddleware<any> = {
  name: "context-engineering",

  async onStart(ctx) {
    const { state, graphName } = ctx;
    if (!state?.projectId || !state?.jwt) return;

    // 1. Find last AI message timestamp
    const lastAiTime = findLastAiMessageTime(state.messages || []);

    // 2. Get agent's subscriptions
    const eventTypes = AGENT_EVENT_SUBSCRIPTIONS[graphName] || [];
    if (eventTypes.length === 0 && !state.intent) return;

    // 3. Fetch events from Rails (by project, not thread)
    const api = new RailsAPI({ jwt: state.jwt });
    const rawEvents = await api.agentContextEvents.list({
      project_id: state.projectId,
      event_types: eventTypes,
      since: lastAiTime?.toISOString(),
    });

    if (rawEvents.length === 0 && !state.intent) return;

    // 4. Merge consecutive events
    const mergedEvents = mergeConsecutiveEvents(rawEvents);

    // 5. Build context items
    const contextItems: Array<{ timestamp: Date; message: string }> = [];

    for (const event of mergedEvents) {
      contextItems.push({
        timestamp: new Date(event.created_at),
        message: event.message,
      });
    }

    // 6. Add intent (last, just before user message)
    if (state.intent) {
      const formatter = INTENT_FORMATTERS[state.intent.type];
      if (formatter) {
        contextItems.push({
          timestamp: new Date(state.intent.createdAt),
          message: formatter(state.intent.payload),
        });
      }
    }

    // 7. Sort chronologically
    contextItems.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // 8. Inject before last message
    const messages = [...(state.messages || [])];
    const lastMessage = messages.pop();

    const contextHumanMessages = contextItems.map(
      (item) => new HumanMessage({ content: `[Context] ${item.message}` })
    );

    // 9. Update state
    ctx.state = {
      ...state,
      messages: [...messages, ...contextHumanMessages, lastMessage].filter(Boolean),
      intent: undefined,
    };
  },
};

function findLastAiMessageTime(messages: any[]): Date | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg instanceof AIMessage || msg._getType?.() === "ai") {
      return msg.additional_kwargs?.timestamp ? new Date(msg.additional_kwargs.timestamp) : null;
    }
  }
  return null;
}
```

### Add to Bridge

```typescript
// langgraph_app/app/api/middleware/usageTracking.ts

import { contextEngineeringMiddleware } from "./contextEngineering";

export const createAppBridge = createBridgeFactory({
  middleware: [contextEngineeringMiddleware, usageTrackingMiddleware],
});
```

---

## File List

### New Files (Rails)

| File                                                        | Purpose            |
| ----------------------------------------------------------- | ------------------ |
| `db/migrate/XXXXXX_create_agent_context_events.rb`          | Table              |
| `app/models/agent_context_event.rb`                         | Model + formatters |
| `app/models/concerns/tracks_agent_context.rb`               | Callback concern   |
| `app/controllers/api/v1/agent_context_events_controller.rb` | API                |

### New Files (Langgraph)

| File                                                     | Purpose             |
| -------------------------------------------------------- | ------------------- |
| `app/middleware/context/subscriptions.ts`                | Agent subscriptions |
| `app/middleware/context/merging.ts`                      | Event merging       |
| `app/middleware/context/contextEngineeringMiddleware.ts` | Stream middleware   |
| `app/middleware/context/index.ts`                        | Exports             |

### New Files (Frontend)

| File                                  | Purpose             |
| ------------------------------------- | ------------------- |
| `frontend/lib/intent.ts`              | Intent utilities    |
| `frontend/hooks/usePageNavigation.ts` | Page visit tracking |

### Modified Files

| File                                  | Changes                           |
| ------------------------------------- | --------------------------------- |
| `config/routes.rb`                    | Add agent_context_events resource |
| `shared/state/core.ts`                | Add `intent` field                |
| `app/api/middleware/usageTracking.ts` | Add context middleware            |
| `app/models/website.rb`               | Add TracksAgentContext            |
| `app/models/upload.rb`                | Add TracksAgentContext            |
| `app/models/domain.rb`                | Add TracksAgentContext            |
| `app/models/campaign.rb`              | Add TracksAgentContext            |

---

## Implementation Order

### Phase 1: Rails Foundation

1. Create migration
2. Create AgentContextEvent model with formatters
3. Create TracksAgentContext concern
4. Create API controller
5. Add routes
6. Test: Manual creation works

### Phase 2: Image Picker (Highest Pain Point)

1. Add concern to Upload model
2. Test: Upload image → event created
3. Test: Delete image → event created

### Phase 3: Langgraph Middleware

1. Create subscriptions config
2. Create merging logic
3. Create stream middleware
4. Add to createAppBridge
5. Test: Events injected into website graph

### Phase 4: Intent Layer

1. Add intent to CoreAnnotation
2. Create frontend intent utilities
3. Wire up insight click → intent → navigation
4. Test: Agent acknowledges insight

### Phase 5: Expand Coverage

1. Add theme.updated to Website
2. Add domain.assigned to Domain
3. Add page.visited from frontend
4. Add ads events (keywords, headlines, budget)

### Phase 6: Consolidate Existing

1. Migrate ads `previousPageState` to page.visited
2. Migrate brainstorm commands to context events
3. Remove old scattered implementations

---

## Verification

### Unit Tests

- [ ] AgentContextEvent validates event_type format (resource.verb)
- [ ] TracksAgentContext creates events on model changes
- [ ] Merging: consecutive theme changes → experimented message
- [ ] Merging: consecutive image uploads → combined list

### Integration Tests

- [ ] Website.update(theme_id: x) → AgentContextEvent created
- [ ] Upload.create (image) → AgentContextEvent created
- [ ] Upload.destroy (image) → AgentContextEvent created
- [ ] API returns formatted messages by project

### End-to-End Tests

- [ ] User uploads images in picker → Agent sees them in next message
- [ ] User deletes image → Agent knows to remove from site
- [ ] User clicks insight → navigates → Agent acknowledges insight
- [ ] User changes theme 3x → Agent sees "experimented with 3 themes"

---

## Key Decisions

1. **Project-scoped, not thread-scoped** - Events belong to projects, any conversation can see them
2. **Model callbacks, not API calls** - Events recorded automatically when data changes
3. **Consistent resource.verb naming** - Predictable, limited verb vocabulary
4. **Rails formats messages** - Langgraph gets pre-formatted strings
5. **Frontend only does page.visited** - Everything else via model callbacks
6. **Intent is ephemeral** - Consumed once, not persisted
7. **Two separate layers** - Events (persistent, project) vs Intent (ephemeral, navigation)
