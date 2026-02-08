# WebsiteFilesBackend Optimization Plan

## Current Issues

1. Every read() hits filesystem even when content hasn't changed
2. Every write()/edit() immediately calls Rails API
3. Subagents read files that main agent already read

## Proposed Architecture

### Phase 1: Batch writes (skip filesystem entirely)

- Agent works with in-memory file map
- Only flush to Rails API at the very end
- No filesystem I/O needed since agent has no bash tools

### Phase 2: Pass content to subagents

- Main agent reads files once
- Pass content in task message to subagents
- Subagents return transformed content
- Main agent batches all writes

### Implementation Sketch

```typescript
class WebsiteFilesBackend {
  private files: Map<string, string> = new Map();  // In-memory store

  async hydrate() {
    // Load from DB into memory map (not filesystem)
    const dbFiles = await db.select()...
    for (const f of dbFiles) {
      this.files.set(f.path, f.content);
    }
  }

  async read(path) {
    return this.files.get(path);  // Memory lookup
  }

  async write(path, content) {
    this.files.set(path, content);  // Just buffer
  }

  async commit() {
    // Single API call with all changed files
    await service.write({ files: Array.from(this.files) });
  }
}
```

This eliminates:

- All filesystem I/O
- Redundant reads (memory map acts as cache)
- Redundant API calls (single flush at end)
