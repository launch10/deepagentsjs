# FAQ Document Management

FAQs are synced from Google Docs and stored in the `documents` and `document_chunks` tables. These power the AI support assistant.

## Workflows

### Load existing FAQs (most developers)

Just load the `basic_account` snapshot - it includes all FAQ documents and chunks:

```bash
# In rails console or via snapshot restore
Database::Snapshotter.restore_snapshot("basic_account")
```

Or run seeds which include FAQs.

### Sync fresh content from Google Docs

Use this when FAQ content has been updated in Google Docs:

1. Start services with the BullMQ worker:
   ```bash
   bin/services dev --full
   ```

2. Go to Admin > Documents (`/admin/documents`)

3. Click **"Force Sync All"** to re-fetch all documents from Google Docs

4. Wait for extraction to complete (watch for `[Worker] Job completed` in logs)

5. Verify chunks were created:
   ```ruby
   Document.all.map { |d| [d.title, d.chunks.count] }
   ```

### Export FAQs to snapshot (after syncing)

After syncing new content, export to the seed file so other developers get the updates:

```bash
bin/rails faqs:export
```

This writes to `db/seeds/faqs.sql`. Commit this file to share with the team.

### Full sync + export workflow

```bash
# 1. Sync from Google Docs (requires bin/services dev --full running)
bin/rails faqs:sync

# 2. Export to seed file
bin/rails faqs:export

# 3. Commit the updated seed file
git add db/seeds/faqs.sql
git commit -m "Update FAQ snapshots"
```

## Architecture

- **Google Docs** - Source of truth for FAQ content (shared with service account)
- **`GoogleDocs::SyncService`** - Fetches docs and queues extraction jobs
- **BullMQ worker** (`pnpm worker:dev`) - Runs LLM extraction to parse Q&A pairs
- **`documents` table** - Stores raw document content and metadata
- **`document_chunks` table** - Stores extracted Q&A pairs

## Troubleshooting

### Documents sync but have no chunks

The BullMQ worker isn't running. Make sure you're using `bin/services dev --full` or run:
```bash
cd ../langgraph_app && pnpm worker:dev
```

### Documents have 0 content length

Check if the Google Doc is shared with the service account:
```
launch10@launch10-479317.iam.gserviceaccount.com
```

Test in console:
```ruby
client = GoogleDocs::Client.new
content = client.get_document_content("DOCUMENT_SOURCE_ID")
puts content.length
```

### Force re-extraction of a single document

```ruby
doc = Document.find(ID)
doc.update!(last_synced_at: nil)
service = GoogleDocs::SyncService.new
# Then sync via admin or console
```
