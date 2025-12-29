# Why Database Snapshots for Testing

## The Problem

Testing Langgraph agents requires realistic data states. You can't test "update an existing website" without first having a website. You can't test "create ads for a completed brainstorm" without first having completed a brainstorm.

Setting up this data for every test is:
- Time-consuming (multiple API calls, AI completions)
- Expensive (real AI API costs)
- Flaky (AI outputs vary)

## The Decision

Maintain **database snapshots** at known work points. Tests can load a snapshot and start from that state.

## The Snapshots

| Snapshot | State | Use Case |
|----------|-------|----------|
| `basic_user` | Subscribed user, no projects | Test project creation |
| `completed_brainstorm` | User finished brainstorming | Test website generation |
| `completed_website` | User has a working website | Test ads builder, deployments |
| `completed_ads` | User has ad campaign ready | Test campaign launch |
| `deployed_website` | Live website on Cloudflare | Test analytics, updates |

## How It Works

### Creating Snapshots

```ruby
# Manually create the desired state in development
user = User.create!(...)
project = Project.create!(...)
# ... complete brainstorm flow ...
# ... verify state is correct ...

# Export snapshot
rake snapshots:export[completed_brainstorm]
```

### Using Snapshots in Tests

```typescript
// Langgraph test
testGraph()
  .withSnapshot("completed_brainstorm")  // Load database state
  .withPrompt("Create a landing page for my idea")
  .execute();
```

The test starts with a real user, real project, real brainstorm output - all loaded from the snapshot.

## Integration with Polly

Snapshots work alongside Polly (HTTP recording):

```
┌─────────────────────────────────────────────────┐
│                    Test Run                      │
│                                                  │
│  1. Load database snapshot                       │
│     - Known data state                          │
│                                                  │
│  2. Run agent with Polly recording              │
│     - AI responses recorded/replayed            │
│                                                  │
│  Result: Deterministic, fast, cheap tests       │
└─────────────────────────────────────────────────┘
```

- **Snapshot**: Database state is deterministic
- **Polly**: AI API responses are deterministic
- **Result**: Fully reproducible tests

## Why This Matters for AI Testing

AI tests are inherently challenging:
- **Non-deterministic**: Same prompt → different outputs
- **Expensive**: Each test hits paid APIs
- **Slow**: API calls take seconds

Snapshots + Polly solve all three:
- Recorded responses = deterministic
- Replayed responses = free
- Local replay = fast

## Debugging Use Case

Snapshots aren't just for tests. They're useful for debugging:

```bash
# Load the "completed_brainstorm" state in development
rake snapshots:load[completed_brainstorm]

# Now manually test the website generation flow
# without going through the full brainstorm first
```

This lets developers jump to any point in the user journey.

## Consequences

**Benefits:**
- Tests start from known good states
- No expensive AI calls during test setup
- Reproducible test runs
- Fast debugging (skip to relevant state)
- Realistic data for integration tests

**Trade-offs:**
- Snapshots can become stale as schema changes
- Need discipline to update snapshots when flows change
- Storage overhead for snapshot files
- Risk of testing against unrealistic data if snapshots diverge from production patterns

## Files Involved

- Snapshot files stored in `langgraph_app/tests/fixtures/snapshots/`
- Rake tasks in `rails_app/lib/tasks/snapshots.rake`
- Test helpers in `langgraph_app/tests/support/`
