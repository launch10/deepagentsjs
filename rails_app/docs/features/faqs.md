# Documents & Document Chunks Implementation Plan

## Overview

We manage FAQs in Google Docs (and optionally other data sources in the future).

These serve as context for AI models in the Brainstorm, Ads, and FAQs flows. Documents are imported from various sources (Google Docs, manual entry, etc.), processed via LLM to extract Q&A pairs, and stored as embeddable chunks for retrieval.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         RAILS APP                                │
├─────────────────────────────────────────────────────────────────┤
│  Zhong Cron (every N mins)                                      │
│       ↓                                                          │
│  GoogleDocs::SyncService                                        │
│       │                                                          │
│       ├─→ Fetches docs from FAQs folder via Google Drive API    │
│       ├─→ Parses frontmatter (slug, status, tags)               │
│       ├─→ Stores/updates Document records                       │
│       ├─→ Creates JobRun record (status: running)               │
│       └─→ Calls Langgraph /api/documents/extract-faqs (async)     │
│                    ↓                                             │
│  Webhooks::DocumentExtractionController                         │
│       │                                                          │
│       ├─→ Receives webhook from Langgraph with Q&A pairs        │
│       ├─→ Calls document.sync_chunks(pairs)                     │
│       ├─→ Updates JobRun (status: completed/failed)             │
│       └─→ Triggers embedding generation via Embeddable          │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                       LANGGRAPH APP                             │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/documents/extract-faqs (enqueues to BullMQ)          │
│       └─→ Returns: { status: 'queued', job_id, ... }            │
│                                                                 │
│  BullMQ Worker: document-extraction                             │
│       │                                                         │
│       ├─→ RecursiveCharacterTextSplitter (3000 chars, 500 overlap)
│       ├─→ Prioritizes splitting on "Question:" boundaries       │
│       ├─→ LLM extracts Q&A pairs from each chunk (parallel)     │
│       ├─→ Deduplicates pairs (keeps longer answers)             │
│       └─→ Sends webhook to Rails with results                   │
│                                                                 │
│  Retrieval (at inference time):                                 │
│       ├─→ Query chunks by tags + vector similarity              │
│       └─→ Cohere rerank before injection into context           │
└─────────────────────────────────────────────────────────────────┘
```

## Writing FAQs in Google Drive

### Folder Structure

FAQs are stored in Google Drive with this structure:

```
Google Drive
└── FAQs
    ├── Live/      ← Documents here are synced to the database
    └── Drafts/    ← Work in progress (not synced)
```

Only documents in the **Live** folder are published. Use Drafts for work in progress.

### Creating a New FAQ Document

1. Navigate to **Google Drive > FAQs > Live**
2. Create a new **Google Doc** (not Sheets, PDFs, etc.)
3. Format using the Q&A structure below

### Document Format

Use `Question:` and `Answer:` prefixes for each Q&A pair:

```
Question: What is an Ad Group?
Answer: An Ad Group is a container inside your Google Ads campaign that holds
your ads and keywords. Think of it as a themed folder...

Question: How many headlines should I write?
Answer: Google recommends at least 3 headlines per ad, but you can add up to 15...
```

### Optional Frontmatter

Add YAML frontmatter at the top for metadata (optional):

```markdown
---
slug: campaign_builder_faq
status: live
type: q_and_a
tags: [ads, campaigns, google_ads]
---

Question: What are Headlines in my ad?
Answer: Headlines are short text snippets...
```

### Service Account Access

The sync uses a service account. If you create a new folder that needs syncing:

1. Share the folder with: `launch10@launch10-479317.iam.gserviceaccount.com`
2. Grant **Viewer** access

## Syncing Documents Manually

To sync documents from Google Drive, ensure you're running the following services:

```bash
cd langgraph_app && pnpm run worker:dev # run BullMQ worker
cd langgraph_app && pnpm run dev # run langgraph server
cd rails_app && bundle exec sidekiq # run Sidekiq
cd rails_app && rails s # run Rails server
```

Now you can run the sync task:

```bash
rake faqs:sync
```

Or, via Rails console, you can call:

```ruby
GoogleDocs::SyncService.perform
```

## Converting to SQL Snapshots

## Concerns

### DocumentConcerns::ChunkSync

Instance method for syncing Q&A pairs with deduplication:

```ruby
# Usage: document.sync_chunks(extracted_pairs)
def sync_chunks(extracted_pairs)
  # Upserts chunks by question_hash
  # Removes chunks no longer in source
  # Triggers embedding generation via Embeddable
end
```

### DocumentConcerns::FrontmatterParsing

Class methods for parsing documents with YAML frontmatter:

```ruby
# Parse raw content
Document.parse_frontmatter(raw_content)
# => { frontmatter: { slug: '...', tags: [...] }, content: '...' }

# Create/update from raw content
Document.find_or_create_from_raw!(raw_content, source_type: 'google_docs')
```

### Embeddable Concern

- Uses neighbor gem to trigger embedding generation on save
- Uses OpenAI to generate embeddings under the hood

## Langgraph Q&A Extraction

### Endpoint: POST /api/documents/extract-faqs

Uses RecursiveCharacterTextSplitter with overlap to handle large documents:

```typescript
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 3000,
  chunkOverlap: 500,
  separators: [
    "\nQuestion:", // Prioritize Q&A boundaries
    "\n\n",
    "\n",
    " ",
    "",
  ],
});

// Process each chunk, extract Q&As, deduplicate by question
// Keeps longer answer when duplicates found in overlapping chunks
```

### Request/Response

```typescript
// Request
POST /api/documents/extract-faqs
{
  "content": "Question: What is an Ad Group?\nAnswer: An Ad Group is...",
  "metadata": { "title": "Campaign Builder FAQ" }
}

// Response
{
  "pairs": [
    {
      "question": "What is an Ad Group?",
      "answer": "An Ad Group is a container inside your Google Ads campaign...",
      "section": "Ad Group Name"
    }
  ]
}
```

## Frontmatter Format

Documents from Google Docs will have optional frontmatter:

```markdown
---
slug: campaign_builder_faq
status: live
type: q_and_a
tags: [ads, campaigns, google_ads]
---

# Ad Campaign Builder FAQ

Question: What are Headlines in my ad?
Answer: Headlines are short text snippets...
```

## Usage Examples

## File Locations

### Rails

- `app/models/document.rb`
- `app/models/document_chunk.rb`
- `app/models/job_run.rb`
- `app/models/concerns/document_concerns/chunk_sync.rb`
- `app/models/concerns/document_concerns/frontmatter_parsing.rb`
- `app/models/concerns/document_concerns/syncable_document.rb`
- `app/clients/google_docs/client.rb`
- `app/clients/langgraph_client.rb`
- `app/services/google_docs/sync_service.rb`
- `app/controllers/webhooks/document_extraction_controller.rb`
- `db/migrate/*_create_documents.rb`
- `db/migrate/*_create_document_chunks.rb`
- `db/migrate/*_create_job_runs.rb`

### Langgraph

- `app/server/routes/documents.ts`
- `app/server/middleware/adminAuth.ts`
- `app/queues/documentExtraction.ts`
- `app/queues/connection.ts`
- `app/workers/documentExtractionWorker.ts`
- `app/services/webhooks/webhookService.ts`
- `server.ts` (route mounting)

## Running the System

### Start the worker (in langgraph_app/)

```bash
pnpm run worker:dev
```

### Sync documents (in Rails console)

```ruby
service = GoogleDocs::SyncService.new
service.sync_all
```

### Monitor job status

```ruby
JobRun.recent.limit(10)
```
