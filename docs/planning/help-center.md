# Help Center - Planning Document

**Branch**: `support-page-with-faqandchat`
**Author**: Claude Code
**Date**: January 31, 2026

---

## Feature Overview

Evolve the `/support` page into a full Help Center with three capabilities:
1. **FAQ Library** — Searchable, filterable FAQ accordion with categories
2. **AI Chat Assistant** — LangGraph-powered chat that answers questions using FAQ content
3. **Contact Form** — Existing support request form (extracted into component)

## Architecture Decisions

### 1. Dedicated FAQ Model (not Documents)

FAQs get their own `faqs` table instead of being stored as a single blob in the `documents` table. This enables:
- Per-question ILIKE search in the database
- Category filtering and ordering via `position`
- Individual publish/unpublish control
- Slug-based URL references for future deep linking
- Direct Drizzle access from LangGraph for AI context injection

### 2. Client-Side FAQ Filtering

FAQs are delivered as Inertia props (not a separate API endpoint). Filtering and search happen entirely on the client:
- Search uses case-insensitive substring matching on question + answer text
- Category filtering via pill buttons with AND logic (search + category)
- No server round-trips for filter changes — instant UI updates

### 3. LangGraph Support Agent (Minimal)

A simple LangGraph agent for v1:
- `loadFaqContext` node loads all published FAQs from the database and formats them as text
- `supportAgent` node uses the FAQ content as system prompt context (no tools for v1)
- Wrapped with `withCreditExhaustion()` for credit tracking
- Uses `createAppBridge()` for automatic billing integration

### 4. Account-Level Support Chat

The Chat model's `ACCOUNT_CHAT_TYPES` is extended with `"support"`. This gives:
- One support chat per account (enforced by existing unique index)
- Chat history persists across sessions
- Standard thread management via existing infrastructure

### 5. Inline Expandable Chat UI

The AI chat is hidden by default and toggled by a button. This keeps the FAQ library as the primary UI and avoids overwhelming new users with a chat interface on first visit.

---

## Files Created

### Rails
| File | Purpose |
|------|---------|
| `docs/planning/help-center.md` | This planning doc |
| `db/migrate/XXXX_create_faqs.rb` | FAQ table |
| `app/models/faq.rb` | FAQ model with validations, scopes, search |
| `db/seeds/help_center_faqs.rb` | Seed ~31 FAQs from Google Doc |
| `spec/models/faq_spec.rb` | FAQ model specs |
| `spec/factories/faqs.rb` | FAQ factory |

### LangGraph
| File | Purpose |
|------|---------|
| `app/annotation/supportAnnotation.ts` | State annotation + bridge |
| `app/nodes/support/loadFaqContext.ts` | Load FAQs from DB |
| `app/nodes/support/agent.ts` | Conversational agent node |
| `app/graphs/support.ts` | Graph definition |
| `app/api/support.ts` | API binding |
| `app/server/routes/support.ts` | HTTP routes |

### Frontend
| File | Purpose |
|------|---------|
| `components/support/ContactForm.tsx` | Extracted contact form |
| `components/support/FaqSearch.tsx` | Search input with debounce |
| `components/support/FaqCategoryFilter.tsx` | Category filter pills |
| `components/support/FaqAccordion.tsx` | Collapsible FAQ items |
| `components/support/FaqSection.tsx` | FAQ section composer |
| `components/support/SupportChat.tsx` | AI chat UI |
| `hooks/useSupportChat.ts` | Chat hook |

## Files Modified

| File | Change |
|------|--------|
| `app/controllers/support_controller.rb` | Pass FAQs, thread_id, jwt, langgraph_path as props |
| `app/models/chat.rb` | Add "support" to ACCOUNT_CHAT_TYPES |
| `app/javascript/frontend/pages/Support.tsx` | Refactor to Help Center layout |
| `app/javascript/frontend/components/navigation/AppSidebar.tsx` | BookOpenIcon + "Help Center" label |
| `langgraph_app/server.ts` | Mount support routes |

---

## FAQ Categories

| Category Key | Display Label | Source |
|-------------|---------------|--------|
| `google_ads` | Google Ads | Google Doc (~31 FAQs) |
| `getting_started` | Getting Started | Placeholder (future) |
| `credits_billing` | Credits & Billing | Placeholder (future) |
| `landing_pages` | Landing Pages | Placeholder (future) |
| `account` | Account | Placeholder (future) |

## FAQ Schema

| Column | Type | Constraints |
|--------|------|------------|
| `question` | string | not null |
| `answer` | text | not null (markdown) |
| `category` | string | not null, inclusion validation |
| `subcategory` | string | nullable, for grouping within category |
| `slug` | string | unique, auto-generated |
| `position` | integer | default: 0 |
| `published` | boolean | default: true |

## Help Center Page Layout

```
┌──────────────────────────────────────────────┐
│ Help Center                                   │
│ Find answers or chat with our AI assistant    │
├──────────────────────────────────────────────┤
│ [🔍 Search FAQs...                         ] │
│ [All] [Getting Started] [Credits] [Ads] ...  │
├──────────────────────────────────────────────┤
│ ▶ Question 1                                  │
│ ▶ Question 2                                  │
│ ▼ Question 3 (expanded)                       │
│   Answer text here...                         │
│ ▶ Question 4                                  │
├──────────────────────────────────────────────┤
│ Can't find what you're looking for?           │
│ [Chat with AI] [Contact Support ↓]           │
├──────────────────────────────────────────────┤
│ ┌─ AI Chat (expandable) ──────────────────┐  │
│ │ Messages...                              │  │
│ │ [Type a message...        ] [Send]       │  │
│ └──────────────────────────────────────────┘  │
├──────────────────────────────────────────────┤
│ Contact Form (always visible)                 │
│ [Category] [Subject] [Description] [Submit]   │
├──────────────────────────────────────────────┤
│ Email us at support@launch10.com               │
└──────────────────────────────────────────────┘
```

## LangGraph Agent Flow

```
START → loadFaqContext → supportAgent → END
         (DB query)      (LLM chat)
         ↓                    ↓
    withCreditExhaustion wrapper
```

## Testing

- FAQ model specs: validations, scopes (published, by_category, search), slug generation
- Updated request specs: verify FAQ props passed, support chat thread_id
- LangGraph: health check endpoint, basic agent response

## Review Checklist

- [ ] FAQ migration creates correct columns and indexes
- [ ] FAQ model validations match category constants
- [ ] Seed data loads all ~31 FAQs from Google Doc
- [ ] SupportController passes FAQ + chat props correctly
- [ ] Chat model accepts "support" type
- [ ] LangGraph support agent compiles and streams
- [ ] FAQ search/filter works on frontend
- [ ] AI chat sends/receives messages
- [ ] Credit gating works for AI chat
- [ ] Contact form still works as before
- [ ] Sidebar shows "Help Center" with BookOpenIcon
- [ ] All existing support specs still pass
