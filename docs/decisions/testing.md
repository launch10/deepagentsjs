# Testing: Decision History

> Decisions about testing approach, fixtures, and reproducibility. Most recent first.

---

## Current State

Database snapshots at known work points + Polly HTTP recording = deterministic, fast, cheap tests. Snapshots let tests start from any point in the user journey. Polly replays AI API responses.

---

## Decision Log

### 2025-12-28: Use Database Snapshots for Testing

**Context:** Testing Langgraph agents requires realistic data states. You can't test "update an existing website" without first having a website. You can't test "create ads for a completed brainstorm" without first having completed a brainstorm.

Setting up this data for every test is:
- Time-consuming (multiple API calls, AI completions)
- Expensive (real AI API costs)
- Flaky (AI outputs vary)

**Decision:** Maintain database snapshots at known work points. Tests can load a snapshot and start from that state.

**Why:**

Snapshots + Polly solve AI testing challenges:
- **Non-deterministic**: Recorded responses = deterministic
- **Expensive**: Replayed responses = free
- **Slow**: Local replay = fast

Debugging use case:
```bash
# Load the "completed_brainstorm" state in development
rake snapshots:load[completed_brainstorm]

# Now manually test website generation without going through full brainstorm
```

**Available snapshots:**

| Snapshot | State | Use Case |
|----------|-------|----------|
| `core_data` | Plans, templates, themes | Base data |
| `basic_account` | Subscribed user | Most common starting point |
| `website_created` | Website with brainstorm data | Website features |
| `campaign_created` | Campaign with ad groups | Ads features |

**Trade-offs:**
- Snapshots can become stale as schema changes
- Need discipline to update snapshots when flows change
- Storage overhead for snapshot files
- Risk of testing against unrealistic data if snapshots diverge

**Status:** Current

---

## Files Involved

- `rails_app/test/fixtures/database/snapshots/` - Snapshot files
- `rails_app/lib/tasks/snapshot.rake` - Snapshot rake tasks
- `rails_app/spec/snapshot_builders/` - Builder classes
- `langgraph_app/tests/__recordings__/` - Polly recordings
- `.claude/skills/database-snapshots.md` - Full snapshot guide
