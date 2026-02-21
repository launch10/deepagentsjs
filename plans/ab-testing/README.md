# A/B Testing & Experimentation: Product Architecture

## Context

Launch10 helps users test business ideas via landing pages, Google Ads, and analytics. A/B testing is the natural next layer: instead of one landing page per idea, users run structured experiments across customer segments, copy variants, and feature toggles.

**Dogfooding imperative:** Launch10's own marketing site (`landing_page/`) has ICP-specific pages (founders, home-services) with a proposed variant system (`landing_page/plans/agent.md`). The goal is to fully replace the marketing site with Launch10's own product. This means the product must support everything the marketing site does today -- and more.

**Relationship to master agent:** This feature becomes a skill domain in the master agent architecture (`plans/agents/future.md`). The experiments skill sits alongside website, brainstorm, ads, and analytics skills.

---

## The Vision: What Users Can Do

### Act 1: Strategy (Agent-Guided)

A founder says: *"I'm building a scheduling tool. I think it could work for hair salons and also for personal trainers."*

The brainstorm agent captures this. The website agent builds the landing page. Then:

> **Agent:** You've identified two distinct customer segments. I'd recommend a **segmentation experiment** -- one variant targeting hair salons (emphasizing no-shows and rebooking) and another targeting personal trainers (emphasizing client retention). Each gets its own Google Ads campaign with segment-specific keywords. Want me to set this up?

The agent:
1. Creates an Experiment (type: `segmentation`)
2. Generates two variants with tailored hero copy, pain points, testimonials, CTAs
3. Suggests ad groups per variant with segment-specific keywords
4. Sets up UTM routing (`utm_content=variant-hair-salons`) so each ad group drives traffic to the correct variant

### Act 2: Implementation (Structured Patterns)

Every variant follows the same code pattern. The generated landing page includes a variant router that reads `utm_content` and renders the right content:

```tsx
function Hero() {
  const headline = useVariantContent({
    control: "The scheduling tool that grows with you",
    "hair-salons": "Stop losing revenue to no-shows",
    "personal-trainers": "Keep every client on track",
  });
  return <h1>{headline}</h1>;
}
```

One deploy serves all variants. `utm_content=variant-hair-salons` triggers the right content. L10.track captures the variant on every visit and lead.

### Act 3: Insights (Data-Driven Recommendations)

After 2 weeks:

> **Insights:** Your "Hair Salons" variant converts at 4.2% vs 1.8% for "Personal Trainers." Hair salons have a $12 CPL vs $38 for trainers. With 95% confidence, hair salons are your stronger segment.
>
> **Recommendation:** Pause the trainers variant, double down on salon messaging. Consider testing copy angles within the salon segment next -- "no-show prevention" vs "rebooking automation."

### Act 4: Compound Learning

Over time, the system accumulates project knowledge:
- **Segment performance:** "Hair salons convert 2.3x better than personal trainers"
- **Feature insights:** "Pages showing a pricing table convert 40% better than pages without"
- **Copy patterns:** "Pain-point headlines outperform aspirational headlines for this audience"
- **Ad performance:** "These keywords + this variant = lowest CPL"

This feeds back into brainstorm, website, and ads agents. The system gets smarter with every experiment.

### Act 5: The Experiment Lifecycle

```
User describes idea
  -> Brainstorm captures audience segments
  -> Agent recommends experiment type

Agent creates experiment
  -> Generates variant content (useVariantContent patterns)
  -> Suggests matching ad groups per variant
  -> Single deploy serves all variants

Traffic arrives via Google Ads
  -> utm_content routes to correct variant
  -> L10.track captures variant on every visit/lead
  -> Analytics aggregates per-variant metrics

Insights agent reviews performance
  -> Statistical significance testing
  -> Recommends: end experiment / extend / new variant
  -> User declares winner

Winner becomes default
  -> Agent suggests next experiment
  -> Compound learning improves future recommendations
```

---

## What the Marketing Site Does Today (Dogfooding Requirements)

The existing `landing_page/` has features the product MUST support:

### 1. ICP-Specific Content (Customer Segmentation)
- **Current:** Two ICP configs (`founders.ts`, `home-services.ts`) with completely different copy
- **Content structure (ICPContent interface):** hero, painPoints, solutionOverview, howItWorks, comparison, socialProof, pricing, FAQ, finalCta
- **Each section** has headline, accent text, and section-specific data
- **Product requirement:** The website agent must generate structured, section-level variant content -- not random file edits. The variant system needs a content schema that maps cleanly to page sections.

### 2. Content-Driven Rendering
- **Current:** `ICPLandingPage.tsx` renders 9 sections, each reading from `ICPContentProvider` context
- **Deep merge:** `getICPContent(slug, variantId)` merges variant overrides on top of base config
- **Product requirement:** Generated landing pages need a similar pattern -- a content structure that variants can override at the section level. The `useVariantContent()` pattern from `landing_page/plans/agent.md` is the right approach.

### 3. Variant Support via URL Params
- **Current:** `?v=variantId` param read by `ICPLandingPage.tsx`, passed to context provider
- **Proposed (agent.md):** `?utm_variant=` or `utm_content=variant-{slug}` for marketing consistency
- **Product requirement:** Use `utm_content=variant-{slug}` because it's already captured by L10.trackVisit(), stored on Ahoy::Visit, and denormalized onto WebsiteLead. Zero changes to the tracking library.

### 4. PostHog + UTM Tracking
- **Current:** Every event includes variant_id + UTM params via `getUtmProperties()`
- **Events tracked:** page_view, icp_page_view, cta_clicked, tier_selected, signup_attempt, signup_success
- **UTM capture:** First-touch attribution in localStorage (30-day TTL), forwarded to Rails on signup
- **Product requirement:** L10.track already captures utm_content. Need to resolve variant from utm_content server-side and tag visits/leads with variant_id.

### 5. Google Ads Conversion Tracking
- **Current:** gtag fires on signup_success with value + currency
- **Product requirement:** Already supported via L10.createLead(). Each variant's ad group gets its own utm_content, so conversions are naturally attributed to variants.

### 6. ICP -> Signup Attribution
- **Current:** `buildAppUrl()` forwards UTM params + `icp` identifier when redirecting to Rails
- **Rails side:** `UtmTracking` concern captures into `signup_attribution` cookie -> persisted on Account
- **Product requirement:** For end-user websites, L10.track already handles this. For Launch10 dogfooding, the product needs to capture which variant/segment a lead came through and store it on the lead record.

### Gap Analysis: What the Product Doesn't Have Yet

| Marketing Site Feature | Product Status | Needed For |
|----------------------|---------------|------------|
| ICP-specific content configs | No equivalent | Segment variants |
| Deep merge variant overrides | No equivalent | Any variant type |
| Variant registry (planned in agent.md) | No equivalent | TypeScript enforcement |
| `useVariantContent()` hook | No equivalent | Client-side variant rendering |
| Per-variant PostHog tracking | L10.track has utm_content | Variant attribution |
| Experiment data model | No tables exist | Everything |
| Variant preview switching | No equivalent | Development UX |
| Per-variant analytics | Metrics are per-project only | Experiment analysis |
| Statistical significance testing | No equivalent | Experiment decisions |
| Agent experiment awareness | No equivalent | Strategy recommendations |

---

## Data Model

### New Tables

#### `experiments`
```
id, uuid, name, experiment_type, status, hypothesis,
winner_variant_id (FK), started_at, completed_at, deleted_at,
website_id (FK), account_id (FK),
created_at, updated_at
```

- `experiment_type`: `split_test | segmentation | copy_test | layout_test | feature_test`
- `status`: `draft | running | paused | completed`
- `hypothesis`: Agent-generated or user-provided (e.g., "Hair salons convert better than personal trainers")
- **Constraint:** One running experiment per website (MVP -- avoids variant collision)

#### `experiment_variants`
```
id, uuid, name, slug, description,
is_control (boolean), traffic_weight (int 0-100),
status, segment_config (jsonb), deleted_at,
experiment_id (FK), account_id (FK),
created_at, updated_at
```

- `segment_config`: ICP/segment metadata
  ```json
  {
    "icp": "hair-salons",
    "audience": "Local hair salon owners",
    "pain_points": ["no-shows", "rebooking"],
    "messaging_angle": "revenue protection"
  }
  ```
- `is_control`: Existing website = control (no file duplication needed)
- `slug`: Used in UTM routing (`utm_content=variant-{slug}`)

#### `variant_files`
```
id, path, content, content_tsv, shasum, deleted_at,
variant_id (FK), website_id (FK),
created_at, updated_at
```

- Only files that DIFFER from control are stored
- Same deduplication pattern as website_files vs template_files
- `ExperimentVariant#resolved_files` overlays variant_files on top of code_files

### Extended Existing Tables

- **`ahoy_visits`**: add `variant_id` (nullable FK to experiment_variants)
- **`website_leads`**: add `variant_id` + `experiment_id` (nullable FKs)
- **`analytics_daily_metrics`**: add `variant_id` + `experiment_id`, extend unique index to include variant

### Model Relationships

```
Website has_many :experiments
Experiment belongs_to :website
Experiment has_many :variants (ExperimentVariant)
Experiment has_one :control_variant (where is_control: true)
ExperimentVariant has_many :variant_files
ExperimentVariant has_many :visits (Ahoy::Visit)
ExperimentVariant has_many :website_leads
```

---

## UTM -> Variant -> Tracking Flow

### URL Convention
```
https://my-startup.launch10.site/                              -> control
https://my-startup.launch10.site/?utm_content=variant-speed    -> speed variant
https://my-startup.launch10.site/?utm_content=variant-salons   -> hair-salons variant
```

**Why utm_content:**
- Already captured by L10.trackVisit() and stored on Ahoy::Visit
- Already denormalized onto WebsiteLead
- Google Ads natively supports utm_content per ad creative
- No changes to the L10.track client library
- Follows marketing industry conventions

### Server-Side Variant Resolution

```ruby
# app/services/experiments/variant_resolver_service.rb
class Experiments::VariantResolverService
  def self.resolve(website:, utm_content:)
    return nil unless utm_content&.start_with?('variant-')
    slug = utm_content.sub('variant-', '')
    experiment = website.experiments.find_by(status: 'running')
    experiment&.variants&.find_by(slug: slug)
  end
end
```

Modified in `TrackingController#visit`: resolve variant from utm_content, set `variant_id` on Ahoy::Visit.
Modified in `Leads::ProcessWorker`: save `variant_id` + `experiment_id` on WebsiteLead.

### Client-Side Variant Router

Template file at `templates/default/src/lib/variants.ts`:

```typescript
// VARIANTS constant populated at build time by deploy pipeline
const VARIANTS: Record<string, { id: string; slug: string; name: string }> = {};

export function getCurrentVariant() {
  const params = new URLSearchParams(window.location.search);
  const utmContent = params.get('utm_content');
  if (!utmContent?.startsWith('variant-')) return null;
  return VARIANTS[utmContent.replace('variant-', '')] || null;
}

export function useVariantContent<T>(
  content: Record<string, T>,
  defaultKey = 'control'
): T {
  const variant = getCurrentVariant();
  return content[variant?.slug || defaultKey] ?? content[defaultKey];
}
```

### Complete Flow
```
User clicks ad (utm_content=variant-salons)
  -> Landing page loads
  -> L10.trackVisit() sends utm_content to Rails API
  -> Rails resolves variant-salons -> ExperimentVariant record
  -> Ahoy::Visit created with variant_id
  -> variants.ts reads utm_content -> useVariantContent() renders salon content
  -> User submits email -> L10.createLead()
  -> Rails creates WebsiteLead with variant_id + experiment_id
  -> AnalyticsDailyMetric aggregated per variant
  -> Insights graph compares variant performance
```

---

## Website Agent Integration

### Strategy vs Implementation Separation

This is the core architectural principle:

**Strategy layer** (agent decides WHAT to test):
- Classifies experiment type from user intent
- Suggests variant angles from brainstorm data (idea, audience, solution, pain points)
- Recommends which sections to differentiate (hero only? full page? feature visibility?)
- Suggests matching Google Ads ad groups per variant
- Recommends when to end experiments based on data

**Implementation layer** (always the same code patterns):
- `useVariantContent()` for text swaps (most common)
- Component swaps for layout differences (less common)
- Feature flags for section visibility (`showTestimonials: true/false`)
- Variant router reads `utm_content`, renders correct content
- L10.track captures variant on every event automatically

The agent always implements via the same structured patterns, regardless of experiment type. This ensures clean data flow.

### Experiment Type Classification

| Signal from User | Experiment Type | Agent Behavior |
|-----------------|----------------|----------------|
| "Different audiences" / "segments" / "ICPs" | `segmentation` | Variant per audience with tailored messaging throughout |
| "Try different headlines" / "test copy" | `copy_test` | Text-swap variants, minimal file changes |
| "Different layouts" / "redesign hero" | `layout_test` | Component-swap variants, structural changes |
| "Show/hide pricing" / "test features" | `feature_test` | Feature flag variants, section visibility toggles |
| Default / ambiguous | `split_test` | Agent determines best approach |

### Agent Context: Experiment Awareness

When the website agent starts, its prompt includes active experiments:

```
## Active Experiments

### "Customer Segment Test" (segmentation) - running 14 days
Variants:
  - Control: Default messaging
  - Hair Salons (hair-salons): Pain-point focused on no-shows
  - Personal Trainers (personal-trainers): Focused on client retention

useVariantContent() blocks exist in:
  - src/components/Hero.tsx (headline, subheadline, CTA)
  - src/components/PainPoints.tsx (pain point list)
  - src/components/Testimonials.tsx (testimonial selection)
```

New agent context event types:
- `experiment.created`, `experiment.started`, `experiment.completed`
- `variant.created`, `variant.updated`

### Website Graph Intents

Add to the website intent graph:
- `create_variant`: Create experiment + generate variant files
- `edit_variant`: Edit a specific variant's content (scoped to variant's files)

### Variant Creation Flow

1. User: "Create a variant targeting hair salons"
2. Intent router -> `create_variant`
3. `classifyExperimentNode`: Determine type (`segmentation`)
4. If no experiment, create one via Rails API
5. `createVariantNode`: Coding agent reads current files, generates variant using `useVariantContent()` patterns
6. Save variant_files via Rails API (only files that differ from control)
7. Return preview with variant switcher active

### Coding Agent Prompt for Variants

New shared prompt (`langgraph_app/app/prompts/coding/shared/experiments.ts`):

```
## Variant Content Pattern

When creating variants, use the useVariantContent() pattern:

### Pattern 1: Text Swap (most common)
const headline = useVariantContent({
  control: "Build your landing page",
  "hair-salons": "Stop losing revenue to no-shows",
});

### Pattern 2: Component Swap
const HeroComponent = useVariantContent({
  control: DefaultHero,
  "hair-salons": SalonHero,
});

### Pattern 3: Feature Flag
const showPricing = useVariantContent({
  control: true,
  "speed-test": false,
});

Rules:
1. Only create files that DIFFER from control
2. Every useVariantContent() must include ALL variant slugs
3. Keep component structure identical -- only change content/styling
4. Import useVariantContent from '@/lib/variants'
```

---

## Deploy Pipeline

### Single Deploy Serving All Variants

The deploy pipeline builds ONE artifact that serves all variants:

1. Normal build from code_files (control + template merged)
2. Read active experiment's variants from Rails API
3. Inject variant config into `src/lib/variants.ts` (populate VARIANTS constant)
4. Components with `useVariantContent()` dynamically render based on `utm_content`

**Modified file:** `app/models/concerns/website_deploy_concerns/buildable.rb` -- inject variant config at build time.

This means:
- One domain, one URL, one deploy per website
- Variant selection is client-side (fast, no server round-trip)
- Google Ads sets utm_content per ad creative -> correct variant renders
- All tracking flows through existing pipeline

---

## Analytics & Insights

### Per-Variant Metrics

Extend `Analytics::ComputeMetricsForProjectWorker`:
- Group visits by variant_id -> page_views, unique_visitors per variant per day
- Group website_leads by variant_id -> leads per variant per day
- Google Ads metrics by utm_content -> cost per variant per day
- Create AnalyticsDailyMetric rows per (project, date, variant)

### Experiment Analysis Service

New service: `Analytics::ExperimentAnalysisService`

Per experiment, computes:
- **Per-variant:** visitors, leads, conversion rate, CPL, ROAS
- **Statistical significance:** Z-test for two proportions (control vs each treatment)
- **Confidence level:** 95% threshold for "significant"
- **Lift vs control:** "+34% conversion rate"
- **Recommendation:** end / extend / review / new variant

### Insights Graph Extension

The insights prompt gets experiment context. New insight action types:
- `end_experiment`: Clear winner with statistical significance
- `extend_experiment`: Not enough data, need more traffic
- `try_new_variant`: Suggest new test based on patterns
- `segment_recommendation`: "Hair salons are your strongest segment"
- `feature_insight`: "Pages with pricing tables convert 40% better"

### Compound Learning (Future)

Over multiple experiments, the system builds per-project knowledge:

```json
{
  "best_segments": [
    {"name": "Hair Salons", "conversion_rate": 4.2, "cpl": 12, "confidence": 0.97}
  ],
  "copy_insights": [
    {"pattern": "Pain-point headlines", "lift_vs_aspirational": "+34%", "experiments": 3}
  ],
  "feature_insights": [
    {"feature": "Pricing table", "with_conversion": 5.1, "without_conversion": 3.2}
  ]
}
```

This feeds into brainstorm and website agents for future projects.

---

## Preview UI

### Variant Switcher in WebsitePreview

Add dropdown to `WebsitePreview.tsx` header when website has active experiment:

```
[Control v] [Hair Salons] [Personal Trainers]    [Reload] [Open]
```

Switching appends `?utm_content=variant-{slug}` to WebContainer iframe URL. Since generated code uses `useVariantContent()`, preview updates immediately via Vite HMR.

### Experiment Management Page

New page at `/projects/:uuid/experiments`:
- List active/completed experiments with status badges
- Per-experiment: variant comparison table (visitors, leads, conversion rate, CPL, significance)
- "Create experiment" -> opens chat with agent pre-prompted
- "End experiment" / "Declare winner" actions
- Visual diff: side-by-side comparison of variant content

### Experiment Dashboard Widgets

On the project dashboard:
- Experiment status card (running / paused / completed)
- Mini variant comparison (conversion rates as bar chart)
- "Best performing variant" callout
- Days running + sample size progress

---

## Google Ads Integration

### Variant -> Ad Group Mapping

Each variant maps to its own ad group within the Google Ads campaign:

```
Campaign: "Scheduling Tool"
  |-- Ad Group: "Control" (utm_content=variant-control)
  |   |-- Keywords: scheduling tool, appointment software
  |   +-- Ads: Generic messaging
  |-- Ad Group: "Hair Salons" (utm_content=variant-hair-salons)
  |   |-- Keywords: salon scheduling, salon no-show, hair appointment software
  |   +-- Ads: Salon-specific messaging
  +-- Ad Group: "Personal Trainers" (utm_content=variant-personal-trainers)
      |-- Keywords: trainer scheduling, fitness appointment, client retention
      +-- Ads: Trainer-specific messaging
```

The ads agent needs experiment awareness:
- When creating campaigns for a website with experiments, create ad groups per variant
- Set utm_content on each ad group's final URL suffix
- Per-variant keywords that match the segment's language

### Lead Tagging

When a lead converts through a variant, the lead record captures:
- Which experiment (`experiment_id`)
- Which variant (`variant_id`)
- The segment_config from the variant (ICP metadata)

This enables the leads table to show: "12 leads from Hair Salons segment, 3 from Personal Trainers"

---

## Phased Implementation Roadmap

### Phase 1: Data Model + CRUD
**New files:**
- `db/migrate/..._create_experiments.rb`
- `db/migrate/..._create_experiment_variants.rb`
- `db/migrate/..._create_variant_files.rb`
- `db/migrate/..._add_variant_to_visits_leads_metrics.rb`
- `app/models/experiment.rb`
- `app/models/experiment_variant.rb`
- `app/models/variant_file.rb`
- `app/controllers/experiments_controller.rb` (Inertia)
- `app/controllers/api/v1/experiments_controller.rb` (JSON API for Langgraph)

**Modified:**
- `app/models/website.rb` -- has_many :experiments
- `app/models/ahoy/visit.rb` -- belongs_to :variant
- `app/models/website_lead.rb` -- variant associations
- `app/models/analytics_daily_metric.rb` -- variant associations

### Phase 2: Tracking Integration
**New:**
- `app/services/experiments/variant_resolver_service.rb`
- `templates/default/src/lib/variants.ts`

**Modified:**
- `app/controllers/api/v1/tracking_controller.rb` -- resolve variant from utm_content
- `app/workers/leads/process_worker.rb` -- save variant_id on WebsiteLead

### Phase 3: Agent Variant Creation
**New:**
- `langgraph_app/app/prompts/coding/shared/experiments.ts`
- `langgraph_app/app/nodes/website/createVariantNode.ts`
- `langgraph_app/app/nodes/website/classifyExperimentNode.ts`

**Modified:**
- `langgraph_app/app/graphs/website.ts` -- create_variant, edit_variant intents
- `shared/config/agentContext.ts` -- experiment event types

### Phase 4: Deploy Pipeline
**Modified:**
- `app/models/concerns/website_deploy_concerns/buildable.rb` -- inject variant config

### Phase 5: Analytics + Insights
**New:**
- `app/services/analytics/experiment_analysis_service.rb`
- `app/controllers/api/v1/experiment_analytics_controller.rb`

**Modified:**
- `app/workers/analytics/compute_metrics_for_project_worker.rb` -- per-variant aggregation
- `app/services/analytics/insights_metrics_service.rb` -- include experiment data
- `langgraph_app/app/nodes/insights/generateInsights.ts` -- experiment-aware insights

### Phase 6: Preview UI + Experiment Management
**New:**
- `app/javascript/frontend/pages/projects/experiments/` (Inertia pages)
- `app/javascript/frontend/components/experiments/` (React components)

**Modified:**
- `app/javascript/frontend/components/website/preview/WebsitePreview.tsx` -- variant switcher
- `config/routes.rb` -- experiment routes

### Phase 7: Strategy Layer + Ads Integration
**New:**
- `langgraph_app/app/prompts/experiments/strategy.ts`

**Modified:**
- `langgraph_app/app/nodes/insights/generateInsights.ts` -- experiment recommendations
- Ads graph -- variant-aware ad group creation

### Phase 8: Master Agent Skill (follows plans/agents/future.md)
- Register experiments as skill domain
- Tools: `create_experiment`, `get_experiment`, `end_experiment`

---

## Key Design Decisions

1. **Single deploy with client-side variant router** -- One URL serves all variants via `useVariantContent()`. Works with existing Cloudflare Atlas pipeline.

2. **utm_content for variant identification** -- Leverages existing tracking pipeline end-to-end. Zero changes to L10.track.

3. **Variant files as overrides** -- Only files that differ from control are stored. Same deduplication as website_files vs template_files.

4. **One experiment per website (MVP)** -- Avoids variant collision. Can relax later with section-scoped experiments.

5. **Strategy vs implementation separation** -- Agent recommends WHAT to test. Implementation always uses `useVariantContent()`. Ensures clean, predictable data flow regardless of experiment type.

6. **Experiment types drive agent behavior** -- Classification (segmentation, copy_test, etc.) determines how many files change, what the agent generates, and how ads are structured. But the underlying code patterns are always the same.

---

## Existing Infrastructure Reused

| Component | Current Use | A/B Testing Use |
|-----------|------------|-----------------|
| `L10.trackVisit()` | Captures utm_content on visits | Variant identification (no changes) |
| `WebsiteLead` | Stores UTM attribution | Stores variant_id + experiment_id |
| `AnalyticsDailyMetric` | Daily aggregation per project | Extended to aggregate per variant |
| `Insights graph` | 3 actionable insights from metrics | Extended with experiment comparison |
| `website_files` / `template_files` | File override pattern | `variant_files` follows same pattern |
| `code_files` view | Merged template + website files | `resolved_files` merges variant on top |
| `Agent context events` | Track model changes for agent awareness | New experiment/variant event types |
| Deploy pipeline (`buildable.rb`) | Builds website from code_files | Injects variant config at build time |
| WebContainer preview | Renders website in iframe | Add utm_content param to switch variants |
| `useVariantContent()` (from `landing_page/plans/agent.md`) | Proposed for marketing site | Same pattern used in generated landing pages |

---

## Critical File Paths

### Tracking (to modify)
- `rails_app/app/controllers/api/v1/tracking_controller.rb`
- `rails_app/app/workers/leads/process_worker.rb`
- `rails_app/templates/default/src/lib/tracking.ts`

### Analytics (to modify)
- `rails_app/app/workers/analytics/compute_metrics_for_project_worker.rb`
- `rails_app/app/services/analytics/insights_metrics_service.rb`
- `langgraph_app/app/nodes/insights/generateInsights.ts`

### Website Agent (to modify)
- `langgraph_app/app/graphs/website.ts`
- `langgraph_app/app/nodes/coding/agent.ts`
- `shared/config/agentContext.ts`

### Deploy (to modify)
- `rails_app/app/models/concerns/website_deploy_concerns/buildable.rb`

### Preview (to modify)
- `rails_app/app/javascript/frontend/components/website/preview/WebsitePreview.tsx`

### Marketing site patterns (reference)
- `landing_page/src/config/icp/types.ts` -- ICPContent interface (content schema reference)
- `landing_page/src/config/icp/founders.ts` -- Example ICP content config
- `landing_page/src/pages/ICPLandingPage.tsx` -- Section-based rendering
- `landing_page/src/utils/analytics.ts` -- PostHog + variant tracking
- `landing_page/src/utils/utm.ts` -- UTM capture + forwarding
- `landing_page/plans/agent.md` -- Proposed variant registry architecture
