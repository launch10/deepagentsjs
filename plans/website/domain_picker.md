# Subdomain Picker Plan

## Overview

Add AI-powered domain recommendations to the existing website flow by adding a node to the website graph.

## Current State

- `SetupSubDomain.tsx` exists with a TODO for availability check
- `ContextController` exists, returns website context
- `DomainsController` has `search` action that checks domain availability
- Frontend uses `useWebsiteChat` hook to get website graph state
- Website graph has `buildContext` node that fetches brainstorm data

## Architecture

```
Frontend                      Rails                      Website Graph
─────────                    ─────────                  ───────────────
useDomainContext() ────────→ domain_context API
useWebsiteChat() ─────────────────────────────────────→ domainRecommendations node
                                                        (runs in parallel, idempotent)
```

**Key insight:** Domain recommendations is a node in the website graph, not a separate API. The frontend combines:
1. Domain data from Rails (existing domains, URLs, credits)
2. AI recommendations from website graph state (via `useWebsiteChat`)

---

## Phase 1: Rails APIs (Two Endpoints)

### 1. Context API for LLM (already exists, extend if needed)

The existing `GET /api/v1/websites/:website_id/context` already returns brainstorm data. The Langgraph node uses this via `buildContext`.

**No changes needed** - the node already has access to `state.brainstorm` from `buildContext`.

### 2. Domains API for Frontend Picker (NEW)

```ruby
# app/controllers/api/v1/context_controller.rb
def domain_picker_context
  render json: {
    existing_domains: current_account.domains.includes(:website, :website_urls).map { |d|
      d.to_api_json.merge(
        website_name: d.website&.name,
        website_urls: d.website_urls.map { |u| {id: u.id, path: u.path} }
      )
    },
    platform_subdomain_credits: platform_subdomain_credits
  }
end

private

def platform_subdomain_credits
  limit = current_account.plan&.limit_for("platform_subdomains") || 0
  used = current_account.domains.platform_subdomains.count
  {limit: limit, used: used, remaining: [limit - used, 0].max}
end
```

### Route:
```ruby
# config/routes/api.rb
resources :websites, only: [] do
  resource :context, only: [:show], controller: "context"
  get :domain_picker_context, controller: "context", action: :domain_picker_context  # ADD
end
```

### Summary:
| API | Consumer | Data |
|-----|----------|------|
| `GET /context` (existing) | Langgraph `buildContext` | Brainstorm, uploads, theme |
| `GET /domain_picker_context` (new) | Frontend picker | Existing domains, URLs, credits |

---

## Phase 2: Website Graph Node

### Add to WebsiteAnnotation

```typescript
// langgraph_app/app/annotation/websiteAnnotation.ts
export const WebsiteAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,
  // ... existing fields ...

  // Domain recommendations (computed idempotently)
  domainRecommendations: Annotation<Website.DomainRecommendations | undefined>({
    default: () => undefined,
    reducer: (current, next) => next ?? current,  // Don't overwrite if already set
  }),
});
```

### Add type

```typescript
// shared/types/website/domainRecommendations.ts
export interface DomainRecommendation {
  domain: string;
  subdomain: string;
  score: number;
  reasoning: string;
  source: "existing" | "generated";
  availability?: "available" | "unavailable";
}

export interface DomainRecommendations {
  state: "no_existing_sites" | "existing_recommended" | "new_recommended" | "out_of_credits_no_match";
  recommendations: DomainRecommendation[];
  top_recommendation: DomainRecommendation | null;
}
```

### Create Node

```typescript
// langgraph_app/app/nodes/website/domainRecommendations.ts
import { getLLM } from "@core";
import { structuredOutputPrompt } from "@prompts";
import { withStructuredResponse } from "@utils";
import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { z } from "zod";

const suggestionSchema = z.object({
  suggestions: z.array(z.object({
    subdomain: z.string(),
    reasoning: z.string()
  }))
});

export async function domainRecommendationsNode(
  state: WebsiteGraphState,
  config: LangGraphRunnableConfig
): Promise<Partial<WebsiteGraphState>> {
  // Idempotent: skip if already computed
  if (state.domainRecommendations) {
    return {};
  }

  const { brainstorm, jwt } = state;
  if (!brainstorm?.idea) {
    return {};  // Need brainstorm context
  }

  // 1. Generate 10 subdomain candidates
  const llm = await getLLM({ skill: "writing", speed: "blazing" });
  const schemaPrompt = await structuredOutputPrompt({ schema: suggestionSchema });

  const prompt = `
Generate 10 subdomain suggestions for this business:
- Idea: ${brainstorm.idea}
- Audience: ${brainstorm.audience || "Not specified"}
- Solution: ${brainstorm.solution || "Not specified"}

Requirements:
- Subdomains will be: {suggestion}.launch10.site
- Must be lowercase, alphanumeric, hyphens allowed
- Max 30 characters
- Memorable and brandable
- Avoid generic terms like "landing", "page", "site"

Generate 10 varied options.

${schemaPrompt}`;

  const result = await withStructuredResponse({ llm, prompt, schema: suggestionSchema });
  const candidates = result.suggestions.map(s => `${s.subdomain}.launch10.site`);

  // 2. Check availability via Rails API
  const availabilityRes = await fetch(`${process.env.RAILS_URL}/api/v1/domains/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ candidates })
  });
  const availability = await availabilityRes.json();

  // 3. Filter to available, take top 3
  const availableSuggestions = result.suggestions
    .filter(s => {
      const domain = `${s.subdomain}.launch10.site`;
      const status = availability.results?.find((r: any) => r.domain === domain);
      return status?.status === "available";
    })
    .slice(0, 3)
    .map(s => ({
      domain: `${s.subdomain}.launch10.site`,
      subdomain: s.subdomain,
      score: 80,
      reasoning: s.reasoning,
      source: "generated" as const,
      availability: "available" as const
    }));

  return {
    domainRecommendations: {
      state: availableSuggestions.length ? "new_recommended" : "out_of_credits_no_match",
      recommendations: availableSuggestions,
      top_recommendation: availableSuggestions[0] || null
    }
  };
}
```

### Add to Website Graph (parallel with websiteBuilder)

```typescript
// langgraph_app/app/graphs/website.ts
import { domainRecommendationsNode } from "@nodes";

export const websiteGraph = new StateGraph(WebsiteAnnotation)
    .addNode("buildContext", buildContext)
    .addNode("websiteBuilder", websiteBuilderNode)
    .addNode("domainRecommendations", domainRecommendationsNode)  // ADD
    .addNode("cleanupFilesystem", cleanupFilesystemNode)
    // ... rest of nodes ...

    .addConditionalEdges(START, routeFromStart, {
      cacheMode: "cacheMode",
      buildContext: "buildContext",
      improveCopy: "improveCopy",
    })
    .addEdge("buildContext", "websiteBuilder")
    .addEdge("buildContext", "domainRecommendations")  // ADD: parallel with websiteBuilder
    .addEdge("websiteBuilder", "cleanupFilesystem")
    .addEdge("domainRecommendations", "cleanupFilesystem")  // ADD: both lead to cleanup
    // ... rest of edges ...
```

---

## Phase 3: Frontend

### Add Rails hook (for domain data)

```typescript
// rails_app/app/javascript/frontend/api/domains.hooks.ts
import { useQuery } from "@tanstack/react-query";
import { useJwt, useRootPath } from "~/stores/sessionStore";
import { useWebsiteId } from "~/stores/projectStore";

export const domainContextKeys = {
  all: ["domainContext"] as const,
  forWebsite: (websiteId: number) => [...domainContextKeys.all, websiteId] as const,
};

export function useDomainContext() {
  const jwt = useJwt();
  const rootPath = useRootPath();
  const websiteId = useWebsiteId();

  return useQuery({
    queryKey: domainContextKeys.forWebsite(websiteId ?? 0),
    queryFn: async () => {
      const res = await fetch(`${rootPath}/api/v1/websites/${websiteId}/domain_context`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      return res.json();
    },
    enabled: !!websiteId && !!jwt,
    staleTime: 5 * 60 * 1000,
  });
}
```

### Update SetupSubDomain.tsx

```tsx
// rails_app/app/javascript/frontend/components/website/domain-setup/SetupSubDomain.tsx
import { useDomainContext } from "@/api/domains.hooks";
import { useWebsiteChat } from "@/components/website/hooks/useWebsiteChat";

export default function SetupSubDomain() {
  // Domain data from Rails
  const { data: domainContext } = useDomainContext();

  // AI recommendations from website graph state
  const { state } = useWebsiteChat();
  const recommendations = state?.domainRecommendations;

  // ... existing form code ...

  return (
    <div className="flex flex-col gap-5">
      {/* Existing content */}

      {/* Show AI recommendations */}
      {recommendations?.recommendations && (
        <div className="mt-2 space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Suggested for you</div>
          {recommendations.recommendations.map(rec => (
            <button
              key={rec.domain}
              type="button"
              onClick={() => setValue("subdomain", rec.subdomain)}
              className="flex items-center gap-2 w-full p-2 text-left rounded hover:bg-muted"
            >
              {rec === recommendations.top_recommendation && <span className="text-yellow-500">★</span>}
              <span>{rec.domain}</span>
            </button>
          ))}
        </div>
      )}

      {/* Show existing domains from Rails */}
      {domainContext?.existing_domains?.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Your existing sites</div>
          {domainContext.existing_domains.map(domain => (
            <button
              key={domain.id}
              type="button"
              onClick={() => setValue("subdomain", domain.domain.split(".")[0])}
              className="flex items-center gap-2 w-full p-2 text-left rounded hover:bg-muted"
            >
              <span>{domain.domain}</span>
              {domain.website_name && <span className="text-xs text-muted-foreground">({domain.website_name})</span>}
            </button>
          ))}
        </div>
      )}

      {/* Show credits info */}
      {domainContext?.platform_subdomain_credits?.remaining === 0 && (
        <div className="text-sm text-amber-600">
          You've used all your subdomain credits. <a href="/settings/billing" className="underline">Upgrade</a> for more.
        </div>
      )}
    </div>
  );
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `rails_app/app/controllers/api/v1/context_controller.rb` | Add `domain_context` action (~15 lines) |
| `rails_app/config/routes/api.rb` | Add 1 route line |
| `langgraph_app/app/annotation/websiteAnnotation.ts` | Add `domainRecommendations` field |
| `langgraph_app/app/nodes/website/domainRecommendations.ts` | New node (~80 lines) |
| `langgraph_app/app/graphs/website.ts` | Add node + edges (~5 lines) |
| `shared/types/website/domainRecommendations.ts` | New types (~20 lines) |
| `rails_app/app/javascript/frontend/api/domains.hooks.ts` | New hook (~25 lines) |
| `rails_app/app/javascript/frontend/components/website/domain-setup/SetupSubDomain.tsx` | Add ~30 lines |

**Total: ~180 lines of new code**

---

## Flow Summary

1. User enters chat message to create website
2. Website graph runs:
   - `buildContext` fetches brainstorm data
   - `websiteBuilder` generates the site (in parallel)
   - `domainRecommendations` generates suggestions (in parallel, idempotent)
3. Frontend displays:
   - AI recommendations from `useWebsiteChat().state.domainRecommendations`
   - Existing domains from `useDomainContext()` (Rails API)
   - Credits info from Rails API
4. User selects domain and proceeds

## Verification

```bash
# Rails API
curl -H "Authorization: Bearer $JWT" localhost:3200/api/v1/websites/1/domain_context

# Website graph (run via chat)
# domainRecommendations should appear in state after website generation

# Frontend
# Navigate to website, see recommendations in SetupSubDomain
```
