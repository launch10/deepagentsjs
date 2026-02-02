# Launch10 Agent Context Architecture: Middleware-First Design

## The Vision

Launch10 is a hybrid SAAS/AI app where users move between traditional UI pages and AI agent conversations. The challenge: **agents need to know what the user is doing, why they're there, and what's changed** - without manually wiring every page.

**Key insight:** All context engineering happens in a single middleware layer. Events are recorded automatically via model callbacks. This creates a coherent timeline that any agent can understand.

**Key insight:** Agents already have context on what happens DURING their conversation. The context layer is about events that occur OUTSIDE of the conversation.

**Key insight:** To manage context, we have multiple conversations based on each step of the user's workflow (brainstorm, website, ads, deploy). When conversations need to share context, they need to do so via a **shared project memory**.

### The Problem with Structured Artifacts

Currently, Brainstorm creates a database artifact (`Brainstorm.answers`) that Website consumes. This is:
- **Too rigid**: Website agent must know Brainstorm's model structure
- **Loses nuance**: Structured answers don't capture conversation context ("why did we choose this audience?")

### Solution: Shared Project Memory

A **project-scoped notepad** that any conversation can read/write:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SHARED PROJECT MEMORY                            │
│                                                                      │
│  ## Business Understanding                                           │
│  - Selling premium custom dog portraits to millennial pet owners    │
│  - Key differentiator: hand-painted quality, fast turnaround        │
│  - Price point: $150-300, positioning as "affordable luxury"        │
│                                                                      │
│  ## Audience Insights                                                │
│  - Primary: Women 28-40, urban, treat pets like family members      │
│  - They post pets on social media, want "Instagram-worthy" art      │
│  - Pain point: mass-produced pet products feel impersonal           │
│                                                                      │
│  ## Creative Direction                                               │
│  - Warm, playful tone - not stuffy or corporate                     │
│  - Emphasize the emotional connection, not just the product         │
│  - User prefers Seafoam theme (tried 3, settled on this one)        │
│                                                                      │
│  ## Decisions Made                                                   │
│  - Domain: pawportraits.launch10.site                               │
│  - CTA: "Get Your Portrait" (tested vs "Order Now", felt warmer)    │
└─────────────────────────────────────────────────────────────────────┘
```

**How it differs from Events:**
- Events: "I changed the theme to Seafoam" (what happened)
- Memory: "User prefers warm colors, tried 3 themes, Seafoam felt right" (understanding)

**How it differs from DB artifacts:**
- Brainstorm.answers: `{ audience: "millennial pet owners" }` (structured, rigid)
- Memory: Full context about WHY and nuances discovered in conversation

### Memory Write Patterns

**1. On significant decisions** - Agent writes when user makes a key choice:
```
User: "Let's target millennial pet owners who treat their dogs like family"
Agent: [writes to memory] "Audience: millennial pet owners, emotional connection angle"
```

**2. Workflow transition reflection** - When starting a new workflow (e.g., brainstorm → website), the agent reflects on the previous conversation to capture anything that might have been missed:
```
[Website agent starting]
Agent: "Before we build, let me review what we discussed in brainstorm..."
[Reads brainstorm conversation, writes any missed insights to memory]
```

### Memory Format

**Freeform markdown** - Agents write whatever structure makes sense. This keeps it flexible and human-readable:

```markdown
## Business
Premium custom dog portraits for millennial pet owners.
Positioning: "affordable luxury" at $150-300.
Key differentiator: hand-painted quality + fast 2-week turnaround.

## Audience
Primary: Women 28-40, urban, treat pets like family.
They want "Instagram-worthy" art, not mass-produced products.
Emotional angle resonates more than quality/price messaging.

## Website Direction
Warm, playful tone - decided against corporate feel.
Theme: Seafoam (tried Ocean Blue and Coral, felt too cold/aggressive).
CTA: "Get Your Portrait" beat "Order Now" - warmer, more personal.

## Key Decisions
- Domain: pawportraits.launch10.site
- Hero image: User's own dog photo as example (not stock)
- Pricing: Show packages, not custom quotes (reduces friction)
```

### Memory vs Events vs Artifacts

| Layer | Purpose | Example | Persistence |
|-------|---------|---------|-------------|
| **Events** | What happened | "Theme changed to Seafoam" | Permanent log |
| **Memory** | Why & understanding | "Seafoam felt warm, matched brand tone" | Evolving document |
| **Artifacts** | Structured data | `website.theme_id = 5` | Database records |

Events are append-only. Memory can be refined/updated. Artifacts are source of truth for data.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RAILS MODELS                                 │
│  • Model callbacks automatically create AgentContextEvents          │
│  • Events are PROJECT-SCOPED (not thread-scoped)                    │
│  • Consistent resource.verb naming (theme.updated, images.created)  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTEXT MIDDLEWARE                                │
│  Wraps every graph via createAppBridge                               │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ 1. Get last AI message timestamp from conversation            │  │
│  │ 2. Fetch events for PROJECT since that timestamp              │  │
│  │ 3. Summarize events by type (theme → final theme, etc.)       │  │
│  │ 4. Consume intent from state (navigation, insight clicks)     │  │
│  │ 5. Build context messages IN ORDER of occurrence              │  │
│  │ 6. Inject as HumanMessages before current user message        │  │
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
// === Memory (long-term context from previous conversations) ===
SystemMessage: "## Project Context

## Business
Premium custom dog portraits for millennial pet owners.
Positioning: affordable luxury at $150-300.

## Audience
Women 28-40, urban, treat pets like family.
Emotional angle resonates more than quality messaging.

## Creative Direction
Warm, playful tone - decided against corporate feel."

// === Previous conversation ===
HumanMessage: "Let's build my website"
AIMessage: "<website output>"

// === Recent activity (events + intent, since last AI response) ===
HumanMessage: "[Context] I changed the theme to Seafoam Green"
HumanMessage: "[Context] I uploaded 3 images (hero-dog.jpg, product-1.jpg, product-2.jpg) and deleted 1"
HumanMessage: "[Context] I assigned the domain pawportraits.launch10.site"
HumanMessage: "[Context] I navigated to the Website Builder page"

// === Current user message ===
HumanMessage: "Can we make a more compelling CTA?"
```

### Three Sources of Context

| Source     | What it captures                            | Injected as        | Examples                                                                                                           |
| ---------- | ------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Memory** | Understanding & decisions (freeform markdown) | System message   | "Audience is millennial pet owners", "Chose warm tone over corporate"                                             |
| **Events** | Data changes (stored in DB)                 | Human messages     | Theme updated, images uploaded, domain assigned                                                                    |
| **Intent** | User actions (ephemeral, from localStorage) | Human message      | Page navigation, clicking an insight, clicking "Build my site", "Edit Section"                                     |

Memory provides long-term context. Events + Intent provide recent activity context.

### Event Summarization

Multiple events of the same type get summarized:

| Event Type                              | Raw Events           | Summarized Output                        |
| --------------------------------------- | -------------------- | ---------------------------------------- |
| `theme.updated`                         | 3 theme changes      | "I changed the theme to [final theme]"   |
| `images.created` + `images.deleted`     | 3 creates, 2 deletes | "I uploaded 3 and deleted 2"             |
| `keywords.created` + `keywords.deleted` | 5 creates, 2 deletes | "I edited keywords (added 5, removed 2)" |

**The agent only needs to know the net result, not the journey.**

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

**Note:** Navigation events (page visits) use the **Intent** system, not events.

### Event Types

Events record **data changes** in the system. Navigation and user actions that should trigger agent reactions use the **Intent** system instead (see Layer 5).

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
  images.created
  theme.updated

  # Ads
  keywords.created
  keywords.deleted
  headlines.updated
  descriptions.updated
  budget.updated
  campaign.paused
  campaign.resumed
].freeze
```

---

## Layer 1: AgentContextEvent (Rails)

Events are **project-scoped**, not thread-scoped. They simply record "what happened" in a project. When an agent needs context, it fetches events for its project since the last AI response.

### Model

```ruby
# app/models/agent_context_event.rb
class AgentContextEvent < ApplicationRecord
  acts_as_paranoid
  acts_as_tenant :account

  belongs_to :project
  belongs_to :user
  belongs_to :eventable, polymorphic: true, optional: true

  # Consistent resource.verb format
  VALID_VERBS = %w[created updated deleted assigned unassigned completed paused resumed].freeze

  validates :event_type, presence: true, format: {
    with: /\A[a-z_]+\.(#{VALID_VERBS.join('|')})\z/,
    message: "must be in format 'resource.verb' with valid verb"
  }
  validates :project, presence: true

  scope :since, ->(time) { where('created_at > ?', time) }
  scope :for_project, ->(project_id) { where(project_id: project_id) }
  scope :of_types, ->(types) { where(event_type: types) }
  scope :chronological, -> { order(created_at: :asc) }

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

    # Primary query pattern: events for a project since a timestamp
    add_index :agent_context_events, [:project_id, :created_at]
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
    # Find the associated project
    proj = find_project
    return unless proj # Can't track without a project

    payload_data = payload_proc.is_a?(Proc) ? payload_proc.call(self) : (payload_proc || {})

    AgentContextEvent.create!(
      account: Current.account || proj.account,
      user: Current.user,
      project: proj,
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

### Upload (Images Created)

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

### Ad Keywords

```ruby
# app/models/ad_keyword.rb
class AdKeyword < ApplicationRecord
  include TracksAgentContext

  belongs_to :ad_group

  # Each keyword change creates an individual event.
  # The middleware will summarize: "I added 5 keywords and removed 2"
  tracks_agent_context_on_create 'keywords.created',
    payload: ->(k) { { keyword: k.text } }

  tracks_agent_context_on_destroy 'keywords.deleted',
    payload: ->(k) { { keyword: k.text } }
end
```

**Note:** Even for bulk operations (adding 10 keywords at once), each keyword creates its own event. The middleware summarizes them at read time. This is simpler than creating batch events in service layers.

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

## Layer 4: API Controller (Rails)

The API exposes events for Langgraph middleware to fetch.

```ruby
# app/controllers/api/v1/agent_context_events_controller.rb
class Api::V1::AgentContextEventsController < Api::BaseController
  # GET /api/v1/agent_context_events
  # Called by Langgraph middleware to fetch context for a project
  def index
    events = current_account.agent_context_events

    events = events.for_project(params[:project_id]) if params[:project_id]
    events = events.of_types(params[:event_types]) if params[:event_types]
    events = events.since(params[:since]) if params[:since]

    render json: events.chronological.limit(100).map { |e|
      {
        id: e.id,
        event_type: e.event_type,
        payload: e.payload,
        created_at: e.created_at
      }
    }
  end
end
```

**Note:** The frontend does NOT create events directly. Events are created via model callbacks when data changes. Navigation and user actions use the **Intent** system instead.

---

## Layer 5: Intent (User Actions that Trigger Agent Reactions)

**Intent** handles immediate user actions. Unlike Events (which record data changes), Intent captures **navigation, interactions, and actions** that should affect the graph.

### Intent Types

| Type | Behavior | Examples |
|------|----------|----------|
| **Action** | Do something, exit. No conversation. | `change-theme`, `delete-image`, `upload-images` |
| **Context** | Add context, then continue normal flow | `navigate`, `address-insight` |
| **Directive** | Guide the conversation | `edit-section` (tells agent what to focus on) |

### How Intent Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INTENT MIDDLEWARE (all intents)                   │
│                                                                      │
│  1. If agent subscribes to this intent type:                         │
│     → Inject as context message: "[Context] I changed the theme"    │
│                                                                      │
│  2. Keep intent in state (don't clear - handler will do that)       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         ROUTER (graph entry)                         │
│                                                                      │
│  if (intent?.type === 'change-theme')  →  themeHandler node         │
│  if (intent?.type === 'upload-images') →  imageHandler node         │
│  else                                  →  normal conversation flow   │
└─────────────────────────────────────────────────────────────────────┘
```

**Key insight:** Even action intents can become context messages (if the agent subscribes), so the model knows what happened. The middleware processes all intents for context; the router decides if an action handler is needed.

```typescript
// shared/types/intent.ts
export interface AgentIntent {
  type: "address-insight" | "navigate" | "edit-section" | "quick-action";
  payload: Record<string, unknown>;
  createdAt: string;
}

// Examples:
// { type: 'address-insight', payload: { title: 'Headlines driving down conversion', action: 'fix headlines' } }
// { type: 'navigate', payload: { page: 'Ads Builder', path: '/ads' } }
// { type: 'edit-section', payload: { section: 'hero' } }
```

```typescript
// shared/state/core.ts - add to CoreAnnotation
intent: Annotation<AgentIntent | undefined>({
  default: () => undefined,
  reducer: (_, next) => next,
}),
```

### Frontend Intent Management

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
  // Expire after 5 minutes
  if (Date.now() - new Date(intent.createdAt).getTime() > 5 * 60 * 1000) {
    return null;
  }
  return intent;
}
```

### Usage Examples

```typescript
// When user clicks a dashboard insight
function onInsightClick(insight: Insight) {
  stashIntent({
    type: "address-insight",
    payload: {
      title: insight.title,
      description: insight.description,
      suggestedAction: insight.action,
    },
  });
  navigate("/chat");
}

// When user navigates to a page
function usePageNavigation() {
  const location = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (location.pathname === lastPath.current) return;
    lastPath.current = location.pathname;

    const pageName = PAGE_NAMES[location.pathname];
    if (pageName) {
      stashIntent({
        type: "navigate",
        payload: { page: pageName, path: location.pathname },
      });
    }
  }, [location.pathname]);
}

// When user clicks "Edit Section"
function onEditSectionClick(sectionName: string) {
  stashIntent({
    type: "edit-section",
    payload: { section: sectionName },
  });
  openChat();
}
```

---

## Layer 6: Langgraph Middleware

### Agent Subscriptions

```typescript
// langgraph_app/app/middleware/context/subscriptions.ts

/**
 * Each agent subscribes to event types it cares about.
 * Events are data changes; navigation/actions use the Intent system.
 */
export const AGENT_EVENT_SUBSCRIPTIONS: Record<string, string[]> = {
  website: [
    "theme.updated",
    "images.created",
    "images.deleted",
    "domain.assigned",
    "domain.unassigned",
    "website.deployed",
  ],
  brainstorm: ["topic.completed", "brand_voice.updated", "logo.created", "colors.updated"],
  ads: [
    "keywords.created",
    "keywords.deleted",
    "headlines.updated",
    "descriptions.updated",
    "budget.updated",
    "campaign.paused",
    "campaign.resumed",
  ],
};
```

### Event Summarization

The middleware fetches all events since the last AI message, then **summarizes by event type**.

**Key insight:** We don't merge "consecutive" events. We group ALL events of the same type and produce ONE summary per type.

```typescript
// langgraph_app/app/middleware/context/summarization.ts

interface RawEvent {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface SummarizedEvent {
  event_type: string;
  message: string;
  created_at: string; // Timestamp of the LAST event of this type
}

/**
 * Group events by type and summarize each group into a single message.
 *
 * Input:  [theme.updated, theme.updated, images.created, images.deleted, theme.updated]
 * Output: [
 *   { event_type: 'theme.updated', message: 'I changed the theme to Seafoam' },
 *   { event_type: 'images', message: 'I uploaded 1 image and deleted 1' }
 * ]
 */
export function summarizeEvents(events: RawEvent[]): SummarizedEvent[] {
  // Group by event type (or event category for related types like images.created/deleted)
  const groups = groupEvents(events);

  const summaries: SummarizedEvent[] = [];

  for (const [groupKey, groupEvents] of Object.entries(groups)) {
    const summary = SUMMARIZERS[groupKey]?.(groupEvents);
    if (summary) {
      summaries.push(summary);
    }
  }

  // Sort by the timestamp of the last event in each group
  return summaries.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

function groupEvents(events: RawEvent[]): Record<string, RawEvent[]> {
  const groups: Record<string, RawEvent[]> = {};

  for (const event of events) {
    // Group related event types together
    const groupKey = getGroupKey(event.event_type);
    groups[groupKey] = groups[groupKey] || [];
    groups[groupKey].push(event);
  }

  return groups;
}

function getGroupKey(eventType: string): string {
  // Group related event types for summarization
  if (eventType.startsWith("images.")) return "images"; // images.created + images.deleted
  if (eventType.startsWith("keywords.")) return "keywords"; // keywords.created + keywords.deleted
  return eventType;
}

/**
 * Summarizers: Given all events of a type, produce a single summary.
 */
const SUMMARIZERS: Record<string, (events: RawEvent[]) => SummarizedEvent> = {
  // Theme: Just report the final theme
  "theme.updated": (events) => {
    const last = events[events.length - 1];
    return {
      event_type: "theme.updated",
      message: `I changed the theme to ${last.payload.theme_name || "a new theme"}`,
      created_at: last.created_at,
    };
  },

  // Images: Summarize creates and deletes
  images: (events) => {
    const created = events.filter((e) => e.event_type === "images.created");
    const deleted = events.filter((e) => e.event_type === "images.deleted");
    const last = events[events.length - 1];

    const parts: string[] = [];
    if (created.length > 0) {
      const names = created.map((e) => e.payload.filename as string);
      if (created.length <= 3) {
        parts.push(`uploaded ${names.join(", ")}`);
      } else {
        parts.push(`uploaded ${created.length} images`);
      }
    }
    if (deleted.length > 0) {
      parts.push(`deleted ${deleted.length}`);
    }

    return {
      event_type: "images",
      message: `I ${parts.join(" and ")}`,
      created_at: last.created_at,
    };
  },

  // Keywords: Summarize creates and deletes
  keywords: (events) => {
    const created = events.filter((e) => e.event_type === "keywords.created");
    const deleted = events.filter((e) => e.event_type === "keywords.deleted");
    const last = events[events.length - 1];

    const parts: string[] = [];
    if (created.length > 0) parts.push(`added ${created.length}`);
    if (deleted.length > 0) parts.push(`removed ${deleted.length}`);

    return {
      event_type: "keywords",
      message: `I edited keywords (${parts.join(", ")})`,
      created_at: last.created_at,
    };
  },

  // Domain: Report current state
  "domain.assigned": (events) => {
    const last = events[events.length - 1];
    return {
      event_type: "domain.assigned",
      message: `I assigned the domain ${last.payload.domain}`,
      created_at: last.created_at,
    };
  },

  // Everything else: Just use the last event's message
  default: (events) => {
    const last = events[events.length - 1];
    return {
      event_type: last.event_type,
      message: last.message || `${last.event_type}: ${JSON.stringify(last.payload)}`,
      created_at: last.created_at,
    };
  },
};
```

### Stream Middleware

```typescript
// langgraph_app/app/middleware/context/contextEngineeringMiddleware.ts

import { type StreamMiddleware } from "langgraph-ai-sdk";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AGENT_EVENT_SUBSCRIPTIONS } from "./subscriptions";
import { summarizeEvents } from "./summarization";
import { RailsAPI } from "@rails_api";

const INTENT_FORMATTERS: Record<string, (p: any) => string> = {
  "address-insight": (p) =>
    `I saw this insight on my dashboard: "${p.title}" - ${p.description}. ${p.suggestedAction ? `Suggested action: ${p.suggestedAction}` : ""}`,
  navigate: (p) => `I navigated to the ${p.page} page`,
  "edit-section": (p) => `I want to edit the ${p.section} section of my website`,
  "quick-action": (p) => `I want to ${p.action}`,
};

export const contextEngineeringMiddleware: StreamMiddleware<any> = {
  name: "context-engineering",

  async onStart(ctx) {
    const { state, graphName } = ctx;
    const projectId = state?.projectId;
    if (!projectId || !state?.jwt) return;

    // 1. Find last AI message timestamp
    const lastAiTime = findLastAiMessageTime(state.messages || []);

    // 2. Get agent's subscriptions
    const eventTypes = AGENT_EVENT_SUBSCRIPTIONS[graphName] || [];
    if (eventTypes.length === 0 && !state.intent) return;

    // 3. Fetch events from Rails for this project since last AI response
    const api = new RailsAPI({ jwt: state.jwt });
    const rawEvents = await api.agentContextEvents.list({
      project_id: projectId,
      event_types: eventTypes,
      since: lastAiTime?.toISOString(),
    });

    if (rawEvents.length === 0 && !state.intent) return;

    // 4. Summarize events by type (multiple events → one summary per type)
    const summarizedEvents = summarizeEvents(rawEvents);

    // 5. Build context items from summaries
    const contextItems: Array<{ timestamp: Date; message: string }> = [];

    for (const summary of summarizedEvents) {
      contextItems.push({
        timestamp: new Date(summary.created_at),
        message: summary.message,
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

## Layer 7: Shared Project Memory

Memory is a freeform markdown document that captures understanding across conversations.

### Model

```ruby
# app/models/project_memory.rb
class ProjectMemory < ApplicationRecord
  acts_as_tenant :account

  belongs_to :project

  # Single memory document per project
  validates :project_id, uniqueness: true

  # content is a text column containing markdown
end
```

### Migration

```ruby
# db/migrate/XXXXXX_create_project_memories.rb
class CreateProjectMemories < ActiveRecord::Migration[8.0]
  def change
    create_table :project_memories do |t|
      t.references :account, null: false, foreign_key: true
      t.references :project, null: false, foreign_key: true
      t.text :content, default: ""

      t.timestamps
    end

    add_index :project_memories, :project_id, unique: true
  end
end
```

### API Controller

```ruby
# app/controllers/api/v1/project_memories_controller.rb
class Api::V1::ProjectMemoriesController < Api::BaseController
  before_action :set_project

  # GET /api/v1/projects/:project_id/memory
  def show
    memory = @project.memory || @project.create_memory!
    render json: { content: memory.content, updated_at: memory.updated_at }
  end

  # PATCH /api/v1/projects/:project_id/memory
  # Agents call this to update memory
  def update
    memory = @project.memory || @project.create_memory!

    case params[:operation]
    when 'replace'
      # Full replacement (for major rewrites)
      memory.update!(content: params[:content])
    when 'append'
      # Add to existing content
      memory.update!(content: "#{memory.content}\n\n#{params[:content]}")
    when 'update_section'
      # Update a specific section by heading
      memory.update!(content: update_section(memory.content, params[:section], params[:content]))
    else
      memory.update!(content: params[:content])
    end

    render json: { content: memory.content, updated_at: memory.updated_at }
  end

  private

  def set_project
    @project = current_account.projects.find(params[:project_id])
  end

  def update_section(doc, section_name, new_content)
    # Find section by ## heading and replace its content
    # Returns updated document
    lines = doc.lines
    section_start = lines.index { |l| l.strip == "## #{section_name}" }

    if section_start
      # Find next section or end of doc
      section_end = lines[(section_start + 1)..].index { |l| l.start_with?('## ') }
      section_end = section_end ? section_start + 1 + section_end : lines.length

      # Replace section content
      lines[section_start..section_end - 1] = ["## #{section_name}\n", "#{new_content}\n", "\n"]
    else
      # Section doesn't exist, append it
      lines << "\n## #{section_name}\n#{new_content}\n"
    end

    lines.join
  end
end
```

### Agent Tool for Memory

Agents need a tool to read/write memory. This is exposed as a Langgraph tool:

```typescript
// langgraph_app/app/lib/tools/memoryTool.ts

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { RailsAPI } from "@rails_api";

export const readMemoryTool = tool(
  async ({ projectId }, { configurable }) => {
    const api = new RailsAPI({ jwt: configurable.jwt });
    const memory = await api.projectMemory.get(projectId);
    return memory.content || "(No memory recorded yet)";
  },
  {
    name: "read_project_memory",
    description: "Read the shared project memory to understand context from previous conversations. Call this when you need to know what was discussed/decided before.",
    schema: z.object({
      projectId: z.string().describe("The project ID"),
    }),
  }
);

export const writeMemoryTool = tool(
  async ({ projectId, operation, content, section }, { configurable }) => {
    const api = new RailsAPI({ jwt: configurable.jwt });
    await api.projectMemory.update(projectId, { operation, content, section });
    return "Memory updated.";
  },
  {
    name: "write_project_memory",
    description: "Write to the shared project memory when the user makes a significant decision or you learn something important about their business/goals. Use 'update_section' to modify specific sections.",
    schema: z.object({
      projectId: z.string().describe("The project ID"),
      operation: z.enum(["replace", "append", "update_section"]).describe("How to update: replace all, append to end, or update a specific section"),
      content: z.string().describe("The content to write"),
      section: z.string().optional().describe("Section name (for update_section operation), e.g., 'Business', 'Audience'"),
    }),
  }
);
```

### When Agents Write to Memory

**1. During conversation - on significant decisions:**
```
User: "My target audience is millennial pet owners who treat dogs like family"

Agent thinking: This is a key decision about audience. I should record this.

Agent: [calls write_project_memory with operation='update_section', section='Audience']
Agent: "Great choice! Millennial pet owners..."
```

**2. At workflow transition - reflection:**

When website agent starts and sees this is a new workflow:
```typescript
// In website graph initialization
if (isNewWorkflow(state)) {
  // Read previous conversation (brainstorm) and extract any missed insights
  const brainstormMessages = await getConversationHistory(state.projectId, 'brainstorm');
  const reflection = await reflectOnConversation(brainstormMessages);

  if (reflection.newInsights) {
    await writeMemoryTool.invoke({
      projectId: state.projectId,
      operation: 'append',
      content: reflection.newInsights
    });
  }
}
```

### How Memory Integrates with Context Middleware

Memory is injected as a system message at conversation start:

```typescript
// In contextEngineeringMiddleware.ts

async onStart(ctx) {
  // ... existing event/intent logic ...

  // Also inject memory as system context
  const memory = await api.projectMemory.get(projectId);
  if (memory.content) {
    // Add memory as a system message at the start
    ctx.state.messages = [
      new SystemMessage({
        content: `## Project Context (from previous conversations)\n\n${memory.content}`
      }),
      ...ctx.state.messages
    ];
  }
}
```

---

## File List

### New Files (Rails)

| File                                                        | Purpose              |
| ----------------------------------------------------------- | -------------------- |
| `db/migrate/XXXXXX_create_agent_context_events.rb`          | Events table         |
| `app/models/agent_context_event.rb`                         | Event model          |
| `app/models/concerns/tracks_agent_context.rb`               | Callback concern     |
| `app/controllers/api/v1/agent_context_events_controller.rb` | Events API           |
| `db/migrate/XXXXXX_create_project_memories.rb`              | Memory table         |
| `app/models/project_memory.rb`                              | Memory model         |
| `app/controllers/api/v1/project_memories_controller.rb`     | Memory API           |

### New Files (Langgraph)

| File                                                     | Purpose              |
| -------------------------------------------------------- | -------------------- |
| `app/middleware/context/subscriptions.ts`                | Agent subscriptions  |
| `app/middleware/context/summarization.ts`                | Event summarization  |
| `app/middleware/context/contextEngineeringMiddleware.ts` | Stream middleware    |
| `app/middleware/context/index.ts`                        | Exports              |
| `app/lib/tools/memoryTool.ts`                            | Memory read/write tools |

### New Files (Frontend)

| File                                  | Purpose                                |
| ------------------------------------- | -------------------------------------- |
| `frontend/lib/intent.ts`              | Intent utilities (stash/consume)       |
| `frontend/hooks/usePageNavigation.ts` | Stash navigation intent on page change |

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

### Phase 1: Rails Foundation (Events)

1. Create migration for `agent_context_events`
2. Create `AgentContextEvent` model
3. Create `TracksAgentContext` concern
4. Create events API controller
5. Add routes
6. Test: Manual creation works

### Phase 2: Model Integration

1. Add concern to Website (theme.updated)
2. Add concern to Upload (images.created/deleted)
3. Add concern to Domain (domain.assigned/unassigned)
4. Add concern to Campaign (budget, pause/resume)
5. Test: CRUD operations create context events

### Phase 3: Langgraph Middleware (Events)

1. Create subscriptions config
2. Create summarization logic
3. Create stream middleware
4. Add to createAppBridge
5. Test: Events fetched and summarized correctly

### Phase 4: Intent Layer

1. Add intent to CoreAnnotation (shared state)
2. Create frontend intent utilities (stash/consume)
3. Add usePageNavigation hook (stashes navigation intent)
4. Wire intent into middleware (converts to context message)
5. Test: Clicking insight → agent acknowledges it

### Phase 5: Shared Project Memory

1. Create migration for `project_memories`
2. Create `ProjectMemory` model
3. Create memory API controller (read/write/update_section)
4. Create Langgraph memory tools (read_project_memory, write_project_memory)
5. Add memory to context middleware (inject as system message)
6. Add memory tools to relevant graphs (brainstorm, website, ads)
7. Test: Agent writes decision → another agent reads it

---

## Verification

### Unit Tests

- [ ] AgentContextEvent validates event_type format
- [ ] AgentContextEvent requires a project
- [ ] TracksAgentContext creates events on model changes
- [ ] Summarization: multiple theme changes → "I changed the theme to [final]"
- [ ] Summarization: created + deleted images → "I uploaded 3 and deleted 2"
- [ ] Summarization: no previous AI message → no events fetched
- [ ] ProjectMemory: update_section replaces existing section
- [ ] ProjectMemory: update_section appends if section doesn't exist

### Integration Tests

- [ ] Website.update(theme_id: x) → AgentContextEvent created
- [ ] Upload.create → AgentContextEvent created (if image)
- [ ] Events API returns events for project since timestamp
- [ ] Intent stash/consume works with 5-minute expiry
- [ ] Memory API: read returns content
- [ ] Memory API: update_section modifies correct section

### End-to-End Tests

- [ ] User changes theme 3x → Agent sees "I changed the theme to [final theme]"
- [ ] User uploads 3 images, deletes 1 → Agent sees "I uploaded 3 and deleted 1"
- [ ] User clicks dashboard insight → Agent proactively offers to help
- [ ] Brainstorm agent writes audience decision → Website agent reads it
- [ ] Website agent sees memory context in system message

---

## Key Decisions

1. **Events are project-scoped, not thread-scoped** - Events record what happened in a project; threads subscribe to them
2. **Model callbacks, not API calls** - Events recorded automatically when data changes
3. **Consistent resource.verb naming** - Predictable, grep-able event types
4. **Limited verb vocabulary** - created, updated, deleted, assigned, unassigned, completed, paused, resumed
5. **Summarization at read time** - All events stored; middleware summarizes when fetching
6. **Intent for immediate actions** - Navigation, insight clicks, and other user actions that should drive agent reactions
7. **Events for data changes** - Theme updates, image uploads, etc.
8. **No events if no AI message** - First conversation starts fresh
9. **Shared memory for understanding** - Freeform markdown document captures "why" across conversations
10. **Memory writes on significant decisions** - Not continuous, just key moments
11. **Workflow transition reflection** - Agents review previous workflow to capture missed context
