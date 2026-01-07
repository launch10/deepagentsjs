# Plan: Analytics Tracking Infrastructure

## Problem

Landing pages need Google Ads conversion tracking for ROAS measurement. Currently:
- Agent hardcodes `posthog.capture()` calls (unnecessary distraction)
- No Google Ads conversion tracking
- Agent distracted by analytics instead of focusing on beautiful pages

## Key Insight: Keep It Simple

**PostHog is out of scope for now.** Reasons:
- Would require giving users our API key (they'd see our data)
- Or each user needs their own PostHog account (friction)
- Or proxy through backend (complex)

**Focus on Google Ads conversions only** - users bring their own Google Ads account, no API key sharing issues.

## Solution

### 1. Google Ads Conversion Tracking (Template)

Add `L10.conversion()` to the template - simple, focused on Google Ads only:

**File:** `rails_app/templates/default/src/lib/tracking.ts`

```typescript
interface ConversionConfig {
  googleAdsId?: string;
}

interface ConversionProperties {
  label: string;        // Google Ads conversion label
  value?: number;       // Conversion value for ROAS
  currency?: string;    // Default: USD
}

export const L10 = {
  _config: {} as ConversionConfig,

  init(config: ConversionConfig) {
    this._config = config;
  },

  /**
   * Track a Google Ads conversion (signup, purchase, etc.)
   * Only use for conversions - not general clicks/pageviews.
   */
  conversion(properties: ConversionProperties) {
    if (window.gtag && this._config.googleAdsId) {
      window.gtag('event', 'conversion', {
        send_to: `AW-${this._config.googleAdsId}/${properties.label}`,
        value: properties.value,
        currency: properties.currency || 'USD',
      });
    }

    // Debug logging in dev
    if (process.env.NODE_ENV === 'development') {
      console.log('[L10.conversion]', properties);
    }
  },
};

// Expose globally
if (typeof window !== 'undefined') {
  window.L10 = L10;
}
```

### 2. Config Injection (Deploy Time)

Google Ads ID injected by Rails at deploy time, NOT hardcoded by agent:

```html
<!-- Rails injects into index.html at deploy -->
<script>
  window.L10_CONFIG = {
    googleAdsId: "<%= website.campaign&.google_ads_customer_id %>",
  };
</script>
```

### 3. Agent Usage

**Agent does NOT add tracking.** Agent focuses on beautiful pages.

Conversion tracking is added **automatically at deploy time** or via pre-deploy instrumentation - agent never thinks about it.

### 4. Deploy Agent Handles Instrumentation

A **deploy agent** (separate from coding agent) handles pre-deploy concerns:
- Analytics/conversion tracking
- SEO meta tags
- Accessibility checks

The deploy agent understands semantic intent - it can look at a form and know "this is the signup conversion" vs "this is a contact form". No brittle heuristics needed.

```
Deploy Agent prompt (excerpt):
"Review this landing page before deployment. Add L10.conversion()
to the primary signup/conversion form. Ensure Google Ads tracking
will fire on successful form submission."
```

This keeps coding agent focused on beautiful pages, while deploy agent ensures production readiness.

---

## Where This Fits in Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CODING AGENT                           │
│                                                             │
│  Focuses on beautiful landing pages                         │
│  Does NOT think about analytics/tracking                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   IN-LOOP VALIDATION                        │
│                                                             │
│  Static checks: TypeScript, links, imports                  │
│  Does NOT touch analytics                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      DEPLOY AGENT                           │
│                                                             │
│  ✓ Add L10.conversion() to signup forms (semantic intent)   │
│  ✓ SEO meta tags                                            │
│  ✓ Accessibility checks                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        DEPLOY                               │
│                                                             │
│  Rails injects google_ads_id from Campaign model            │
│  gtag.js loaded if campaign has Google Ads                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `rails_app/templates/default/src/lib/tracking.ts` | Create L10.conversion() module |
| `langgraph_app/app/nodes/codingAgent/utils/agent.ts` | REMOVE analytics from system prompt |
| `langgraph_app/app/graphs/deployAgent.ts` | New graph for deploy agent (separate plan) |

---

## Key Decisions

1. **Coding agent ignores analytics** - Focuses purely on beautiful pages
2. **Deploy agent handles instrumentation** - Understands semantic intent, no brittle heuristics
3. **Google Ads only (for now)** - No PostHog (would require API key sharing or proxying)
4. **Config from Campaign model** - User's Google Ads ID, not ours

---

## Future Considerations

- PostHog via backend proxy (if we want our own analytics on user pages)
- Conversion label mapping: Campaign → conversion_label lookup
- Meta/Facebook pixel support
