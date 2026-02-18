# Deploy Debugging Runbook

## Debugging Artifacts

Every deploy touches multiple records. Here's what to inspect and in what order.

### 1. Deploy Record

The top-level deploy record tracks overall status and instructions.

```ruby
d = Deploy.last
# or find by project
d = Deploy.where(project_id: project.id).order(:created_at).last

d.id
d.status           # pending, running, completed, failed
d.instructions     # { "website" => true, "google_ads" => true }
d.created_at
d.finished_at      # Should be AFTER all child jobs complete
```

### 2. JobRun Records

Each deploy step creates a JobRun. These are the best timeline source.

```ruby
d.job_runs.order(:created_at).each do |jr|
  puts "#{jr.id} | #{jr.job_class.ljust(25)} | #{jr.status.ljust(10)} | created: #{jr.created_at} | completed: #{jr.completed_at}"
end
```

Expected job classes in order:
1. `GoogleOAuthConnect` — verify OAuth token
2. `GoogleAdsInvite` — invite to MCC
3. `GoogleAdsPaymentCheck` — check payment method
4. `WebsiteDeploy` — build and upload to Cloudflare
5. `CampaignDeploy` — sync campaign to Google Ads

### 3. WebsiteDeploy Record

```ruby
wd = WebsiteDeploy.where(website_id: d.project.website.id).order(:created_at).last

wd.status         # pending, building, completed, failed
wd.version_path   # e.g. "1/20260218134316" — nil means never uploaded to R2
wd.shasum          # SHA of files at deploy time
wd.created_at
wd.updated_at
```

### 4. CampaignDeploy Record

```ruby
cd = CampaignDeploy.where(campaign_id: d.project.campaigns.last.id).order(:created_at).last

cd.status
cd.steps_completed  # Array of completed Google Ads sync steps
cd.created_at
cd.updated_at
```

### 5. Chat & Langgraph Thread

```ruby
chat = d.project.chats.where(context_type: "Deploy").last
chat.thread_id  # Use this to query Langgraph state
```

To inspect the Langgraph graph state:
```bash
# From langgraph_app directory
curl -s "http://localhost:4000/api/threads/<thread_id>/state" \
  -H "Authorization: Bearer <jwt>" | jq '.values.tasks'
```

## Log Files

| Log | Location | What to look for |
|-----|----------|-----------------|
| Rails development | `rails_app/log/development.log` | Deploy controller actions, webhook callbacks |
| Google Ads | `rails_app/log/google_ads.log` | Campaign sync steps, API errors |
| Langgraph | Terminal running `pnpm run dev` | Graph execution, node transitions, task status changes |
| Sidekiq | Terminal running Sidekiq | Job enqueue/execute/fail |

## Timeline Reconstruction

When diagnosing timing issues, build a unified timeline:

```ruby
d = Deploy.last

events = []
events << { time: d.created_at, event: "Deploy created (status: #{d.status})" }
events << { time: d.finished_at, event: "Deploy marked #{d.status}" } if d.finished_at

d.job_runs.each do |jr|
  events << { time: jr.created_at, event: "#{jr.job_class} created" }
  events << { time: jr.completed_at, event: "#{jr.job_class} completed (#{jr.status})" } if jr.completed_at
end

wd = WebsiteDeploy.where(website_id: d.project.website.id).order(:created_at).last
if wd
  events << { time: wd.created_at, event: "WebsiteDeploy record created" }
  events << { time: wd.updated_at, event: "WebsiteDeploy updated (#{wd.status})" }
end

cd_record = CampaignDeploy.where(campaign_id: d.project.campaigns.last&.id).order(:created_at).last
if cd_record
  events << { time: cd_record.created_at, event: "CampaignDeploy record created" }
  events << { time: cd_record.updated_at, event: "CampaignDeploy updated (#{cd_record.status})" }
end

events.sort_by { |e| e[:time] }.each do |e|
  puts "#{e[:time].strftime('%H:%M:%S.%L')} | #{e[:event]}"
end
```

## Common Failure Patterns

### Deploy marked completed before campaign finishes

**Symptom:** Frontend shows success screen while "Syncing Campaign" spinner still active.

**Cause:** A deploy node set graph-level `status: "completed"` instead of only marking its task as completed. The `taskExecutor` synced this premature status to Rails.

**Fix:** Deploy nodes should only return task-level status changes via `withPhases()`. The `taskExecutor` determines graph-level completion via `allTasksComplete()`.

### Website flagged as changed when files haven't changed

**Symptom:** `files_changed?` returns `true` even though no code files were modified.

**Cause:** The `files_changed?` method compares against the latest deploy with a `version_path` (meaning it actually uploaded to R2). If no previous deploy has a `version_path`, the system correctly treats it as "changed" since it has no record of what was last uploaded.

**Check:**
```ruby
w = Website.find(id)
WebsiteDeploy.where(website: w).where.not(version_path: nil).order(:created_at).last
# If nil, no previous upload exists — files_changed? will always return true
```

### Campaign deploy fails silently

**Symptom:** Deploy completes but campaign status in Google Ads doesn't match expectations.

**Check:**
```ruby
cd = CampaignDeploy.last
cd.steps_completed  # Which steps finished?
cd.error_message    # Any error?
```

Also check `log/google_ads.log` for API-level errors.

### WebsiteDeploy stuck in "building"

**Symptom:** Deploy hangs, website never completes.

**Check:**
```ruby
wd = WebsiteDeploy.where(status: "building").last
wd.created_at  # How long has it been building?
```

Check Sidekiq for the job status and Cloudflare R2 for upload issues.
