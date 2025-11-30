# Documents & Document Chunks Implementation Plan

## Overview

A system for storing Q&A documents (and other document types) that serve as context for AI models. Documents are imported from various sources (Google Docs, manual entry, etc.), processed via LLM to extract Q&A pairs, and stored as embeddable chunks for retrieval.

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
│       └─→ Calls Langgraph /api/documents/extract-qa (async)     │
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
│                       LANGGRAPH APP                              │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/documents/extract-qa (enqueues to BullMQ)            │
│       └─→ Returns: { status: 'queued', job_id, ... }            │
│                                                                  │
│  BullMQ Worker: document-extraction                             │
│       │                                                          │
│       ├─→ RecursiveCharacterTextSplitter (3000 chars, 500 overlap)
│       ├─→ Prioritizes splitting on "Question:" boundaries       │
│       ├─→ LLM extracts Q&A pairs from each chunk (parallel)     │
│       ├─→ Deduplicates pairs (keeps longer answers)             │
│       └─→ Sends webhook to Rails with results                   │
│                                                                  │
│  Retrieval (at inference time):                                 │
│       ├─→ Query chunks by tags + vector similarity              │
│       └─→ Cohere rerank before injection into context           │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### documents table

Parent records storing the full document content and metadata.

```ruby
create_table :documents do |t|
  t.string :slug, null: false
  t.string :title
  t.text :content                     # Full document content (markdown)
  t.string :status, default: 'draft'  # draft, live
  t.string :document_type             # q_and_a, guide, reference
  t.string :source_type               # google_docs, manual, notion, etc.
  t.string :source_id                 # External ID (Google Doc ID, etc.)
  t.string :source_url                # Link to original source
  t.jsonb :tags, default: []          # ['ads', 'campaigns', 'google_ads']
  t.jsonb :metadata, default: {}      # Flexible metadata storage
  t.datetime :last_synced_at          # When last synced from source
  t.timestamps
end

add_index :documents, :slug, unique: true
add_index :documents, :status
add_index :documents, :document_type
add_index :documents, :source_type
add_index :documents, :tags, using: :gin
```

### document_chunks table

Embeddable Q&A pairs extracted from parent documents.

```ruby
create_table :document_chunks do |t|
  t.references :document, null: false, foreign_key: true
  t.string :question_hash, null: false  # SHA256 of normalized question
  t.text :question, null: false
  t.text :answer, null: false
  t.text :content                       # question + answer for embedding
  t.string :section                     # "Headlines", "Ad Group Name", etc.
  t.jsonb :context, default: {}         # Additional context metadata
  t.integer :position                   # Order within document
  t.vector :embedding, limit: 1536
  t.timestamps
end

add_index :document_chunks, [:document_id, :question_hash], unique: true
add_index :document_chunks, :section
add_index :document_chunks, :embedding, using: :ivfflat, opclass: :vector_cosine_ops
```

## Models

### Document (with Concerns)

```ruby
class Document < ApplicationRecord
  include DocumentConcerns::ChunkSync
  include DocumentConcerns::FrontmatterParsing

  has_many :chunks, class_name: 'DocumentChunk', dependent: :destroy

  validates :slug, presence: true, uniqueness: true
  validates :status, inclusion: { in: %w[draft live] }

  scope :live, -> { where(status: 'live') }
  scope :by_type, ->(type) { where(document_type: type) }
  scope :with_tag, ->(tag) { where('tags @> ?', [tag].to_json) }
  scope :from_source, ->(source) { where(source_type: source) }
end
```

### DocumentChunk

```ruby
class DocumentChunk < ApplicationRecord
  include Embeddable

  belongs_to :document

  validates :question_hash, presence: true, uniqueness: { scope: :document_id }
  validates :question, presence: true
  validates :answer, presence: true

  before_validation :set_question_hash
  before_save :set_content

  scope :by_section, ->(section) { where(section: section) }
  scope :live, -> { joins(:document).where(documents: { status: 'live' }) }

  private

  def set_question_hash
    self.question_hash = Digest::SHA256.hexdigest(question.to_s.downcase.strip)
  end

  def set_content
    self.content = "#{question}\n\n#{answer}"
  end
end
```

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

## Langgraph Q&A Extraction

### Endpoint: POST /api/documents/extract-qa

Uses RecursiveCharacterTextSplitter with overlap to handle large documents:

```typescript
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 3000,
  chunkOverlap: 500,
  separators: [
    '\nQuestion:',  // Prioritize Q&A boundaries
    '\n\n',
    '\n',
    ' ',
    ''
  ],
});

// Process each chunk, extract Q&As, deduplicate by question
// Keeps longer answer when duplicates found in overlapping chunks
```

### Request/Response

```typescript
// Request
POST /api/documents/extract-qa
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

## Implementation Checklist

### Phase 1: Database & Models (Rails) ✅
- [x] Create migration for documents table
- [x] Create migration for document_chunks table
- [x] Create Document model with validations and scopes
- [x] Create DocumentChunk model with Embeddable concern
- [x] Add embedding index for document_chunks

### Phase 2: Concerns (Rails) ✅
- [x] Create DocumentConcerns::ChunkSync for upserting chunks
- [x] Create DocumentConcerns::FrontmatterParsing for parsing markdown frontmatter
- [x] Update Document model to include concerns
- [ ] Create rake task for manual document import

### Phase 3: Q&A Extraction (Langgraph) ✅
- [x] Create /api/documents/extract-qa endpoint
- [x] Implement RecursiveCharacterTextSplitter with Question: boundary priority
- [x] Add chunk overlap (500 chars) to capture Q&As at boundaries
- [x] Implement deduplication (keeps longer answers)
- [x] Add extraction prompt tuned for FAQ-style content
- [x] Add admin auth middleware (service token with `sub: 'service'`, `service: true`)
- [x] Add BullMQ queue for async processing
- [x] Create documentExtractionWorker for background processing
- [x] Add WebhookService to send results back to Rails

### Phase 4: Google Docs Integration ✅
- [x] Set up Google Drive API service account
- [x] Create GoogleDocs::Client for Google Drive/Docs API
- [x] Create GoogleDocs::SyncService for orchestrating sync
- [x] Create JobRun model for tracking async jobs
- [x] Create Webhooks::DocumentExtractionController
- [ ] Add Zhong cron job for periodic sync

### Phase 5: Retrieval API (Future)
- [ ] Create Rails endpoint for searching chunks by tags + similarity
- [ ] Or: Create Langgraph endpoint with Cohere reranking
- [ ] Add to AI agent context injection (ads agent, etc.)

### Phase 6: Admin UI (Future)
- [ ] Document management UI (list, create, edit, delete)
- [ ] Manual Q&A extraction trigger
- [ ] View/edit extracted chunks
- [ ] Sync status dashboard

## Usage Examples

### Manual Document Import

```ruby
# From raw content with frontmatter
raw = File.read('faq.md')
doc = Document.find_or_create_from_raw!(raw, source_type: 'manual')

# Call Langgraph to extract Q&As
response = LanggraphClient.post('/api/documents/extract-qa', {
  content: doc.content,
  metadata: { title: doc.title }
})

# Sync chunks (auto-embeds)
doc.sync_chunks(response['pairs'])
```

### Retrieval at Inference Time

```ruby
# Find relevant chunks for a query
query_embedding = EmbeddingService.generate("What is an ad group?")

chunks = DocumentChunk
  .live
  .with_tag('ads')
  .nearest_neighbors(:embedding, query_embedding, distance: 'cosine')
  .limit(10)

# Inject into AI context
context = chunks.map { |c| "Q: #{c.question}\nA: #{c.answer}" }.join("\n\n")
```

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
