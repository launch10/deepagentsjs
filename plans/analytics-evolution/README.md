# Analytics Evolution: Section Tracking → Validation Scorecard → A/B Testing

## Context

Launch10's core promise is "validate your business idea." The current analytics tell users *what happened* (leads, CPL, CTR charts) but don't tell them *what it means for their idea*. This plan adds three layers that transform reporting into a validation engine:

1. **Section-level engagement tracking** — know which features and sections resonate
2. **Validation scorecard** — a single confidence score answering "is my idea validated?"
3. **A/B testing** — test variants and prove which features people want

Each layer builds on the previous. Section tracking feeds the scorecard. The scorecard benefits from A/B test data. The dependency chain is: tracking → scorecard → A/B testing.

---

## Phase 1: Section-Level Engagement Tracking

### What It Does
Auto-injects visibility tracking into every AI-generated landing page. Tracks which sections users see, which CTAs they click, and how far they scroll — with zero user effort.

### Implementation

#### 1A. Extend the L10 tracking library
**File:** `rails_app/templates/default/src/lib/tracking.ts`

Add three auto-tracking capabilities that read `data-l10-*` attributes:
- **IntersectionObserver** on `[data-l10-section]` elements → fires `section_viewed` event (30% visibility threshold, fires once per section per visit)
- **Click listener** on `[data-l10-cta]` elements → fires `cta_clicked` with section context
- **Scroll depth** → fires `scroll_depth` at 25/50/75/100% thresholds

No API changes to `L10`. The library auto-discovers data attributes on DOMContentLoaded.

#### 1B. Deploy task to inject data attributes
**New file:** `langgraph_app/app/nodes/deploy/sectionTrackingNode.ts`

Follows the exact pattern of the existing `analyticsNode.ts` deploy task. Runs after `AddingAnalytics`. Uses a focused LLM prompt to:
- Add `data-l10-section="hero"` (etc.) to each `<section>` element, derived from component name
- Add `data-l10-cta="hero-signup"` to CTA buttons/links
- No other code changes

**Register in:** `shared/types/deploy/tasks.ts` — add `"AddingSectionTracking"` after `"AddingAnalytics"`

#### 1C. Database: JSONB column for section engagement
**New migration:** Add `section_engagement` JSONB column to `analytics_daily_metrics`

Stores per-day aggregates:
```json
{
  "hero": { "views": 145, "cta_clicks": 23 },
  "features": { "views": 120, "cta_clicks": 5 },
  "scroll_depth": { "25": 200, "50": 150, "75": 80, "100": 45 }
}
```

JSONB is the right choice because section names are dynamic (AI generates different sections for different pages).

#### 1D. Aggregation
**Modify:** `rails_app/app/services/analytics/compute_metrics_service.rb`

Add `compute_section_engagement` method. Query `Ahoy::Event` for `section_viewed`, `cta_clicked`, `scroll_depth` events, grouped by `properties->>'section'`. Store result in the new JSONB column during daily aggregation.

#### 1E. Enriched AI insights
**Modify:** `rails_app/app/services/analytics/insights_metrics_service.rb` — include section engagement in project summaries
**Modify:** `shared/types/insights.ts` — add section engagement schemas and new action types (`review_section`, `optimize_engagement`)
**Modify:** `langgraph_app/app/nodes/insights/generateInsights.ts` — extend system prompt with section engagement interpretation rules:
- Sharp view drop between sections (>50%) → WARNING
- High views + zero CTA clicks → "interesting but not compelling"
- Section with >60% of hero views + >5% CTA CTR → POSITIVE feature validation signal

#### 1F. Frontend visualization
**New components:**
- `components/analytics/SectionEngagementChart.tsx` — horizontal bars showing views per section (ordered by page position)
- `components/analytics/FeatureInterestRanking.tsx` — ranked list of sections by engagement
- `components/analytics/ScrollDepthChart.tsx` — 4-bar chart (25/50/75/100%)

**Modify:** `ProjectPerformance.tsx` — add section engagement section below existing charts
**Modify:** `ProjectPerformanceService` — add `build_section_engagement` method

### Key files
- `rails_app/templates/default/src/lib/tracking.ts` (extend)
- `langgraph_app/app/nodes/deploy/analyticsNode.ts` (pattern to follow)
- `rails_app/app/services/analytics/compute_metrics_service.rb` (extend)
- `langgraph_app/app/nodes/insights/generateInsights.ts` (extend prompt)
- `shared/types/insights.ts` (extend schemas)

---

## Phase 2: Validation Scorecard

### What It Does
A per-project validation score (0-100) synthesized from six dimensions, with an AI-generated go/no-go recommendation. Answers: "Is this idea validated?"

### Architecture Decision: Hybrid Scoring
- **Dimension scores (0-10 each):** Deterministic, rule-based formulas (consistent, testable, fast)
- **Recommendation text:** LLM-generated via existing insights pipeline (contextual, nuanced)

### Data Model

**New table:** `validation_scorecards` (one row per project, updated daily)

```
id, project_id (unique), account_id
overall_score (0-100), maturity_stage (gathering_data|early_signals|confident)
recommendation (text), recommendation_type (continue_testing|pivot_messaging|strong_signal|weak_signal)
demand_signal_score (0-10), cost_efficiency_score (0-10)
feature_interest_score (0-10), willingness_to_pay_score (0-10)
statistical_confidence_score (0-10), market_response_score (0-10)
dimension_details (JSONB — raw inputs for debugging)
computed_at, timestamps
```

### Maturity Stages
| Stage | Criteria | Behavior |
|-------|----------|----------|
| **Gathering Data** | <50 visitors OR <3 days | Gray scores, no recommendation |
| **Early Signals** | 50-500 visitors, 3-14 days | Scores shown with "Early Signals" badge |
| **Confident** | >500 visitors, >14 days | Full scorecard with confident recommendation |

### Overall Score Formula
```
overall = demand_signal * 2.5 + cost_efficiency * 2.0 + market_response * 2.0
        + statistical_confidence * 1.5 + feature_interest * 1.0 + willingness_to_pay * 1.0
```
Weights total 10. Each dimension is 0-10. Max = 100. Feature interest and WTP have lower weight initially (limited data), increasing as section tracking and A/B testing ship.

### Dimension Scoring (Summary)
- **Demand Signal (25%):** conversion_rate score (0-4) + lead_volume score (0-3) + lead_trend score (0-3)
- **Cost Efficiency (20%):** CPL score (0-5, inverted) + CPL trend (0-3) + spend adequacy (0-2)
- **Market Response (20%):** CTR score (0-4) + impression volume (0-3) + CTR trend (0-3)
- **Statistical Confidence (15%):** sample size (0-4) + days of data (0-3) + conversion count (0-3)
- **Feature Interest (10%):** Section diversity, CTA distribution, pricing engagement. Returns neutral (5) until section tracking ships.
- **Willingness to Pay (10%):** Pricing section views/clicks. Returns neutral (5) until pricing experiments exist.

### Benchmarks
**File:** `config/scorecard_benchmarks.yml` — configurable thresholds

| Metric | Poor | Moderate | Good | Excellent |
|--------|------|----------|------|-----------|
| Conversion rate | <1% | 1-3% | 3-7% | >7% |
| CPL | >$50 | $20-50 | $5-20 | <$5 |
| CTR | <0.5% | 0.5-2% | 2-5% | >5% |

### Implementation

#### 2A. Models and migrations
- **New migration:** Create `validation_scorecards` table
- **New model:** `ValidationScorecard` (belongs_to project, belongs_to account)

#### 2B. Services
- **New:** `Analytics::Scorecard::ComputeService` — orchestrator
- **New:** `Analytics::Scorecard::Dimensions::DemandSignal` (+ 5 more dimension classes)
- **New:** `Analytics::Scorecard::Benchmarks` — loads from YAML config

#### 2C. Workers
- **New:** `Analytics::Scorecard::ComputeAllScorecardsWorker` — batch coordinator
- **New:** `Analytics::Scorecard::ComputeScorecardForProjectWorker` — per-project
- **Schedule:** Run daily after `ComputeDailyMetricsWorker` (~5:30 AM)

#### 2D. AI recommendations
- **Modify:** `InsightsMetricsService` — include scorecard data in metrics summary
- **Modify:** `shared/types/insights.ts` — add scorecard schema
- **Modify:** `generateInsights.ts` — extend prompt with scorecard context, output recommendation type + text
- **Modify:** `saveInsights` node — PATCH scorecard recommendation back to Rails

#### 2E. Frontend
- **New:** `components/analytics/ValidationScorecard.tsx` — full scorecard with dimension bars and AI recommendation
- **New:** `components/analytics/ScorecardBadge.tsx` — mini score circle for Dashboard project cards
- **New:** `components/analytics/DimensionBar.tsx` — reusable 0-10 horizontal bar
- **Modify:** `ProjectPerformance.tsx` — add scorecard above summary cards
- **Modify:** `Dashboard.tsx` ProjectCard — add ScorecardBadge

#### 2F. API
- Extend `ProjectsController#performance` to include scorecard in Inertia props
- Extend `DashboardService#build_projects_summary` to LEFT JOIN scorecards for badges
- Add `GET /api/v1/projects/:uuid/scorecard` for Langgraph access

### Key files
- `rails_app/app/services/analytics/project_performance_service.rb` (pattern to follow)
- `rails_app/app/services/analytics/insights_metrics_service.rb` (extend)
- `rails_app/app/javascript/frontend/pages/ProjectPerformance.tsx` (integrate)
- `shared/types/insights.ts` (extend)
- `rails_app/app/workers/analytics/compute_daily_metrics_worker.rb` (pattern to follow)

---

## Phase 3: A/B Testing

### What It Does
Test multiple versions of a landing page (different messaging, features, pricing, audiences). Split traffic via UTM params. Per-variant metrics with statistical significance. Agent-guided experiment creation.

### Architecture (from existing `plans/ab-testing/README.md`)
The existing 672-line design doc is thorough and well-architected. Key decisions already made:
- **Single deploy, client-side variant routing** via `utm_content=variant-{slug}`
- **`useVariantContent()` pattern** for text/component/feature-flag swaps
- **Variant files as overrides** — only files that differ from control are stored
- **One experiment per website** (MVP constraint)
- **Strategy vs implementation separation** — agent decides WHAT to test, code patterns are always the same

### Implementation (following the existing plan's 8 phases)

#### 3A. Data Model + CRUD (Phase 1 from plan)
- **New tables:** `experiments`, `experiment_variants`, `variant_files`
- **Extend:** `ahoy_visits` + `website_leads` + `analytics_daily_metrics` with `variant_id`
- **New controllers:** `ExperimentsController` (Inertia) + `Api::V1::ExperimentsController` (JSON)

#### 3B. Tracking Integration (Phase 2)
- **New:** `Experiments::VariantResolverService` — resolves `utm_content` → variant
- **New:** `templates/default/src/lib/variants.ts` — client-side variant router + `useVariantContent()`
- **Modify:** `TrackingController#visit` — resolve and tag variant_id
- **Modify:** `Leads::ProcessWorker` — save variant_id on WebsiteLead

#### 3C. Agent Variant Creation (Phase 3)
- **New:** coding prompt for variant patterns (`langgraph_app/app/prompts/coding/shared/experiments.ts`)
- **New:** `createVariantNode.ts`, `classifyExperimentNode.ts`
- **Modify:** website graph — add `create_variant`, `edit_variant` intents
- **Modify:** agent context — experiment event types

#### 3D. Deploy Pipeline (Phase 4)
- **Modify:** `buildable.rb` — inject variant config into `src/lib/variants.ts` at build time

#### 3E. Per-Variant Analytics (Phase 5)
- **New:** `Analytics::ExperimentAnalysisService` — per-variant metrics, statistical significance (Z-test for two proportions), lift vs control, recommendation
- **Modify:** `ComputeMetricsForProjectWorker` — aggregate per variant
- **Modify:** `InsightsMetricsService` + `generateInsights.ts` — experiment-aware insights

#### 3F. Preview UI + Experiment Management (Phase 6)
- **New pages:** `/projects/:uuid/experiments` — list, create, manage experiments
- **New components:** variant comparison table, significance indicators, progress bars
- **Modify:** `WebsitePreview.tsx` — variant switcher dropdown

#### 3G. Ads Integration (Phase 7)
- Variant → ad group mapping (each variant gets its own ad group with segment-specific keywords)
- utm_content set per ad creative automatically

#### 3H. Scorecard Integration
- Update `feature_interest_score` dimension to incorporate variant data
- Update `willingness_to_pay_score` to use pricing experiment results
- Increase weights for these dimensions once A/B data is available
- Bayesian probability calculations for "confidence that variant B is better" (VWO SmartStats style)

### Significance Display (Key UX Pattern)
For low-traffic pages, show **progress toward significance** rather than premature conclusions:
```
Variant A: 5.2% conversion (124 visitors)
Variant B: 8.1% conversion (118 visitors)
Confidence: 67% → [████████░░░░░░] Need ~400 more visitors for 95% confidence
```

### Key files
- `plans/ab-testing/README.md` (existing architecture doc — follow it)
- `rails_app/templates/default/src/lib/tracking.ts` (already has utm_content capture)
- `langgraph_app/app/graphs/website.ts` (add variant intents)
- `rails_app/app/models/concerns/website_deploy_concerns/buildable.rb` (inject variant config)

---

## Dependency Graph

```
Phase 1: Section Tracking ──────────────────────────────┐
  1A. L10 library (IntersectionObserver + scroll depth) │
  1B. Deploy task (data-l10-section injection)          │
  1C. Migration (JSONB column)                          │
  1D. Aggregation (ComputeMetricsService)               │
  1E. Enriched insights (LLM prompt + types)            ├──→ Phase 2: Scorecard
  1F. Frontend charts                                   │
                                                        │
Phase 2: Validation Scorecard ──────────────────────────┤
  2A. Model + migration                                 │
  2B. Dimension calculators                             │
  2C. Workers + scheduling                              ├──→ Phase 3: A/B Testing
  2D. AI recommendations (extend insights)              │
  2E. Frontend (scorecard + badges)                     │
  2F. API                                               │
                                                        │
Phase 3: A/B Testing ──────────────────────────────────┘
  3A. Data model (experiments, variants, variant_files)
  3B. Tracking (variant resolver, utm_content routing)
  3C. Agent variant creation
  3D. Deploy pipeline (variant config injection)
  3E. Per-variant analytics + experiment analysis
  3F. UI (experiment management, variant switcher)
  3G. Ads integration (variant → ad group mapping)
  3H. Scorecard enhancement (real feature_interest + WTP scores)
```

## Verification

### Phase 1
- Deploy a test landing page → verify `data-l10-section` attributes present in deployed code
- Visit the page → verify `section_viewed`, `cta_clicked`, `scroll_depth` events appear in `ahoy_events`
- Run daily aggregation → verify `section_engagement` JSONB populated in `analytics_daily_metrics`
- Check AI insights → verify section engagement data appears in LLM-generated insights
- View ProjectPerformance → verify engagement charts render

### Phase 2
- Run scorecard computation for a project with data → verify all 6 dimensions scored correctly
- Check maturity stage logic: project with <50 visitors → "gathering_data"; >500 → "confident"
- Verify AI recommendation generated and saved to scorecard
- View ProjectPerformance → scorecard displays above summary cards
- View Dashboard → score badges appear on project cards

### Phase 3
- Create an experiment via agent chat → verify experiment + variants created in DB
- Deploy website → verify variant config injected, `useVariantContent()` works
- Visit with `?utm_content=variant-{slug}` → verify correct variant renders
- Check tracking → verify variant_id tagged on visits and leads
- View experiment page → verify per-variant metrics and significance indicators
- Run insights → verify experiment-aware recommendations generated
