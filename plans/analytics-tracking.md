# Plan: Analytics Tracking Infrastructure

## Problem

Landing pages need PostHog + Google Ads conversion tracking. Currently:
- Agent hardcodes `posthog.capture()` calls
- No Google Ads conversion tracking
- No standardized way to instrument interactions
- No validation that tracking is properly implemented

## Solution

### 1. Unified Tracking API (Template)

Add `L10.track()` to the template - agent uses this, doesn't worry about implementation:

**File:** `rails_app/templates/default/src/lib/tracking.ts`

```typescript
interface TrackingConfig {
  posthogKey?: string;
  googleAdsId?: string;
}

interface TrackProperties {
  conversion_label?: string;
  value?: number;
  currency?: string;
  [key: string]: any;
}

declare global {
  interface Window {
    L10: {
      track: (event: string, properties?: TrackProperties) => void;
      init: (config: TrackingConfig) => void;
    };
    posthog?: any;
    gtag?: any;
  }
}

export const L10 = {
  _config: {} as TrackingConfig,

  init(config: TrackingConfig) {
    this._config = config;
  },

  track(event: string, properties: TrackProperties = {}) {
    // PostHog
    if (window.posthog) {
      window.posthog.capture(event, properties);
    }

    // Google Ads conversion
    if (window.gtag && properties.conversion_label && this._config.googleAdsId) {
      window.gtag('event', 'conversion', {
        send_to: `AW-${this._config.googleAdsId}/${properties.conversion_label}`,
        value: properties.value,
        currency: properties.currency || 'USD',
      });
    }

    // Debug logging in dev
    if (process.env.NODE_ENV === 'development') {
      console.log('[L10.track]', event, properties);
    }
  },
};

// Expose globally
if (typeof window !== 'undefined') {
  window.L10 = L10;
}
```

### 2. Config Injection (Deploy Time)

Config injected by Rails at deploy/render time, NOT hardcoded by agent:

**Option A:** Environment variables (build time)
```typescript
// vite.config.ts injects from env
L10.init({
  posthogKey: import.meta.env.VITE_POSTHOG_KEY,
  googleAdsId: import.meta.env.VITE_GOOGLE_ADS_ID,
});
```

**Option B:** Runtime injection (deploy time)
```html
<!-- Rails injects into index.html at deploy -->
<script>
  window.L10_CONFIG = {
    posthogKey: "<%= website.posthog_key %>",
    googleAdsId: "<%= website.google_ads_id %>",
  };
</script>
```

### 3. Agent Usage

Agent just uses `L10.track()` - doesn't worry about PostHog/GTM:

```tsx
// Agent writes this
<Button onClick={() => L10.track('cta_clicked', { section: 'hero' })}>
  Get Started
</Button>

<form onSubmit={() => L10.track('signup', {
  conversion_label: 'SIGNUP_LABEL',
  value: 99
})}>
```

### 4. Pre-Deploy Validation (Checklist)

Add tracking validation to pre-deploy checks:

**File:** `langgraph_app/app/services/editor/validation/trackingValidator.ts`

```typescript
interface TrackingValidation {
  passed: boolean;
  warnings: string[];
  suggestions: string[];
}

class TrackingValidator {
  async validate(files: CodeFile[]): Promise<TrackingValidation> {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check 1: L10.track exists somewhere
    const hasTracking = files.some(f => f.content.includes('L10.track'));
    if (!hasTracking) {
      warnings.push('No L10.track calls found - page has no analytics');
    }

    // Check 2: Key interactions should be tracked
    const hasButtons = files.some(f => /<Button|<button/.test(f.content));
    const hasForms = files.some(f => /<form|onSubmit/.test(f.content));
    const hasButtonTracking = files.some(f => /onClick.*L10\.track/.test(f.content));
    const hasFormTracking = files.some(f => /onSubmit.*L10\.track/.test(f.content));

    if (hasButtons && !hasButtonTracking) {
      suggestions.push('CTAs found without tracking - consider adding L10.track to button clicks');
    }
    if (hasForms && !hasFormTracking) {
      warnings.push('Forms found without tracking - signup conversions may not be recorded');
    }

    return {
      passed: warnings.length === 0,
      warnings,
      suggestions,
    };
  }
}
```

---

## Where This Fits in Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CODING AGENT                           │
│                                                             │
│  Uses L10.track() - doesn't know/care about implementation  │
│  System prompt mentions: "Use L10.track for analytics"      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   IN-LOOP VALIDATION                        │
│                                                             │
│  Static checks: TypeScript, links, imports                  │
│  Does NOT check tracking (semantic understanding needed)    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  PRE-DEPLOY VALIDATION                      │
│                                                             │
│  ✓ Runtime errors (browser)                                 │
│  ✓ Tracking validation (grep + heuristics)                  │
│  ✓ SEO meta tags                                            │
│  ✓ Accessibility checks                                     │
│                                                             │
│  Returns: warnings, suggestions (not hard failures)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        DEPLOY                               │
│                                                             │
│  Rails injects config (posthog_key, google_ads_id)          │
│  Config comes from Website model, not hardcoded             │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `rails_app/templates/default/src/lib/tracking.ts` | Create L10 tracking module |
| `rails_app/templates/default/src/main.tsx` | Import and init L10 |
| `langgraph_app/app/services/editor/validation/trackingValidator.ts` | Pre-deploy tracking checks |
| `langgraph_app/app/nodes/codingAgent/utils/agent.ts` | Update system prompt to mention L10.track |

---

## Key Decisions

1. **L10.track() in template** - Agent doesn't implement tracking, just uses it
2. **Config at deploy time** - Not hardcoded by agent, injected by Rails
3. **Tracking validation is pre-deploy** - Needs semantic understanding, not in-loop
4. **Warnings not failures** - Missing tracking is a warning, not a blocker

---

## Future Considerations

- Conversion label mapping: Campaign → conversion_label lookup
- A/B test tracking integration
- Heatmap/session recording config
- GDPR consent mode
