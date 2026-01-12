# Google Ads Integration Test Coverage Plan

## Executive Summary

This plan ensures comprehensive test coverage for the Google Ads API integration. The codebase has **extensive low-level coverage** (485 passing tests across 14 resource types) but the **high-level orchestration tests are broken** (17 of 76 failures in `campaign_deploy_spec`).

### Current State

| Test Layer | Status | Examples | Pass Rate |
|------------|--------|----------|-----------|
| Resource Unit Tests | Passing | 485 | 100% |
| Campaign Deploy Orchestration | Broken | 76 | 78% (59/76) |
| Manual Verification | Completed | N/A | Verified |

### Priority Summary

1. **P0 (Must Fix)**: Align `campaign_deploy_spec` with current implementation
2. **P1 (Should Add)**: Missing `google_sync_result` accessors on models
3. **P2 (Nice to Have)**: Error path testing, idempotency tests

---

## Part 1: Current Failures Analysis

### 17 Failing Tests in `campaign_deploy_spec.rb`

#### Category 1: Step Definition Changes (2 failures)

**Root Cause**: The spec expects `:connect_google_account` as the first step, but the implementation now starts with `:sync_budget`. The account creation and invitation steps have been extracted to be handled by frontend/Langgraph.

**Actual Step Order (from code)**:
```ruby
1. :sync_budget           # First step
2. :create_campaign
3. :create_geo_targeting
4. :create_schedule
5. :create_callouts
6. :create_structured_snippets
7. :create_ad_groups
8. :create_keywords
9. :create_ads            # Last step
```

**Spec Expected Order (outdated)**:
```ruby
1. :connect_google_account  # Removed
2. :create_ads_account      # Commented out
3. :send_account_invitation # Commented out
...
```

**Affected Tests**:
- Line 212: `has :connect_google_account as the first step`
- Line 219: `returns the first step instance` (expects `:connect_google_account`)

**Fix**: Update assertions to expect `:sync_budget` as the first step.

---

#### Category 2: Missing `sync_result` Methods (4 failures)

**Root Cause**: Some step `finished?` methods try to access `google_sync_result` which doesn't exist on all models.

**Affected Models**:
| Model | Method Called | Status |
|-------|--------------|--------|
| `AdsAccount` | `google_syncer.sync_result` | Missing in resource |
| `AdBudget` | `google_sync_result` | Missing method |
| `Campaign` | `google_sync_result` | Missing method |

**Affected Tests**:
- Line 378: `:create_ads_account` step - `AdsAccount#google_sync_result` missing
- Line 672, 688: `:sync_budget` step - `AdBudget#google_sync_result` missing
- Line 725, 744: `:create_campaign` step - `Campaign#google_sync_result` missing

**Fix Options**:
1. Add `google_sync_result` accessors to models that delegate to resource syncers
2. Or update specs to mock/stub these methods since step tests should be unit tests

---

#### Category 3: Factory Validation Failures (9 failures)

**Root Cause**: `AdLocationTarget` factory doesn't set required `google_geo_target_constant` field.

**Error**: `Validation failed: Google geo target constant can't be blank`

**Affected Tests**: All 9 tests in `:create_geo_targeting step` context

**Fix**: Update the `ad_location_target` factory:
```ruby
factory :ad_location_target do
  campaign
  location_name { "New York" }
  country_code { "US" }
  location_type { "City" }
  google_geo_target_constant { "geoTargetConstants/1023191" } # Add this
end
```

---

#### Category 4: Type Mismatch (1 failure)

**Root Cause**: Spec expects string `"555"` but implementation returns integer `555`.

**Affected Test**: Line 1105: `sets criterion_id on new keyword`

**Fix**: Either:
- Update assertion: `expect(new_keyword.reload.google_criterion_id).to eq(555)` (integer)
- Or fix implementation to return string consistently

---

## Part 2: Recommended Fixes

### P0: Critical Fixes (Required for Test Suite to Pass)

#### Fix 1: Update Step Expectations

```ruby
# spec/models/campaign_deploy_spec.rb

# Line 212 - Update first step expectation
it 'has :sync_budget as the first step' do
  expect(CampaignDeploy::STEPS.first.name).to eq(:sync_budget)
end

# Line 219 - Update first step instance expectation
context 'when current_step is nil' do
  it 'returns the first step instance' do
    campaign_deploy.current_step = nil
    step = campaign_deploy.next_step
    expect(step).to be_a(CampaignDeploy::Step)
    expect(step.class.step_name).to eq(:sync_budget)
  end
end
```

#### Fix 2: Remove/Update Obsolete Step Tests

Remove or mark as pending the tests for steps that no longer exist:
- `:create_ads_account` step tests (lines 339-382)
- `:send_account_invitation` step tests (lines 590-644)

Or add back the `google_sync_result` methods if these steps should be re-enabled.

#### Fix 3: Update AdLocationTarget Factory

```ruby
# spec/factories/ad_location_targets.rb
FactoryBot.define do
  factory :ad_location_target do
    campaign
    location_name { "New York" }
    country_code { "US" }
    location_type { "City" }
    google_geo_target_constant { "geoTargetConstants/1023191" }

    trait :synced do
      platform_settings do
        {
          "google" => {
            "criterion_id" => "geoTargetConstants/1023191",
            "remote_criterion_id" => "12345"
          }
        }
      end
    end
  end
end
```

#### Fix 4: Add Missing Model Methods

Either add delegation methods to models, or stub in tests:

```ruby
# Option A: Add to models
class AdBudget < ApplicationRecord
  def google_sync_result
    google_syncer.sync_result
  end
end

class Campaign < ApplicationRecord
  def google_sync_result
    google_syncer.sync_result
  end
end

# Option B: Stub in specs (if method shouldn't exist on model)
before do
  allow(budget).to receive(:google_sync_result).and_return(
    GoogleAds::Resources::SyncResult.success
  )
end
```

#### Fix 5: Fix Type Mismatch

```ruby
# Line 1107 - Use integer comparison
it 'sets criterion_id on new keyword' do
  step.run
  expect(new_keyword.reload.google_criterion_id).to eq(555)  # Integer
end
```

---

### P1: Should Add Tests

#### 1. Add Integration Tests for Current Step Flow

The current spec tests individual steps but lacks full end-to-end flow tests:

```ruby
describe 'full deployment flow' do
  context 'with all required data' do
    let!(:budget) { create(:ad_budget, campaign: campaign) }
    let!(:ad_group) { create(:ad_group, campaign: campaign) }
    let!(:keyword) { create(:ad_keyword, ad_group: ad_group) }
    let!(:ad) { create(:ad, ad_group: ad_group) }

    it 'progresses through all steps until completion' do
      # Mock all Google API calls
      mock_all_google_services

      deploy = CampaignDeploy.deploy(campaign, async: false)

      expect(deploy.status).to eq('completed')
      expect(deploy.current_step).to eq('create_ads')
    end
  end
end
```

#### 2. Add Error Recovery Tests

```ruby
describe 'error recovery' do
  context 'when API call fails mid-deploy' do
    it 'saves progress and can resume' do
      # Allow first 3 steps to succeed
      # Fail on step 4
      # Verify can resume from step 4
    end
  end

  context 'when API returns QUOTA_EXCEEDED' do
    it 'raises retriable error for Sidekiq' do
      # Verify Sidekiq will retry
    end
  end
end
```

#### 3. Add Idempotency Tests

```ruby
describe 'idempotency' do
  context 'when step is run twice' do
    it 'does not create duplicate resources in Google' do
      step.run
      initial_count = google_campaigns_count

      step.run
      expect(google_campaigns_count).to eq(initial_count)
    end
  end
end
```

---

### P2: Nice to Have Tests

#### 1. VCR Integration Tests for Deploy Steps

Add VCR cassettes for full deploy workflow:

```ruby
describe 'deploy with real API', :vcr do
  it 'successfully creates campaign in Google Ads' do
    VCR.use_cassette('campaign_deploy/full_success') do
      deploy = CampaignDeploy.deploy(campaign, async: false)
      expect(deploy.status).to eq('completed')
    end
  end
end
```

#### 2. Concurrent Deploy Tests

```ruby
describe 'concurrent deploy protection' do
  it 'prevents duplicate deploys with distributed lock' do
    threads = 3.times.map do
      Thread.new { CampaignDeploy.deploy(campaign, async: false) }
    end

    results = threads.map { |t| t.value rescue $! }

    expect(results.count { |r| r.is_a?(CampaignDeploy) }).to eq(1)
    expect(results.count { |r| r.is_a?(CampaignDeploy::DeployInProgressError) }).to eq(2)
  end
end
```

#### 3. Performance Tests

```ruby
describe 'bulk operations' do
  context 'with 100 keywords' do
    it 'batches API calls efficiently' do
      create_list(:ad_keyword, 100, ad_group: ad_group)

      expect(api_call_count).to be < 10  # Batched, not 100 calls
    end
  end
end
```

---

## Part 3: Test Coverage Matrix

### Current Coverage by Resource

| Resource | Unit Tests | Integration Tests | Deploy Step Tests | Status |
|----------|-----------|------------------|-------------------|--------|
| Account | 48 | VCR | Commented out | Needs update |
| Budget | 35 | VCR | Broken | Needs fix |
| Campaign | 40 | VCR | Broken | Needs fix |
| LocationTarget | 52 | VCR | Broken (factory) | Needs fix |
| AdSchedule | 89 | VCR | Passing | Good |
| Callout | 32 | VCR | Passing | Good |
| StructuredSnippet | 56 | VCR | Passing | Good |
| AdGroup | 38 | VCR | Passing | Good |
| Keyword | 45 | VCR | Passing (1 type issue) | Minor fix |
| Ad | 38 | VCR | Passing | Good |
| Invitation | 28 | VCR | Commented out | Needs update |
| Favicon | 27 | VCR | N/A | Good |
| FieldMappable | 28 | N/A | N/A | Good |
| Transforms | 19 | N/A | N/A | Good |

### Missing Test Coverage

| Area | Current Coverage | Needed |
|------|-----------------|--------|
| Happy path sync | 100% | Good |
| Error handling (API errors) | 20% | Add VCR error cassettes |
| Retry/recovery | 0% | Add Sidekiq retry tests |
| Idempotency | 0% | Add duplicate prevention tests |
| Rate limiting | 0% | Low priority |
| Concurrent deploys | 25% | Add thread safety tests |
| Full E2E flow | 0% | Add integration test |

---

## Part 4: Implementation Checklist

### Immediate Actions (To Fix Broken Tests)

- [ ] Update step name expectations (`:sync_budget` is first)
- [ ] Update `ad_location_target` factory with `google_geo_target_constant`
- [ ] Add `google_sync_result` methods to `AdBudget` and `Campaign` models
- [ ] Fix keyword criterion_id type mismatch (string vs integer)
- [ ] Remove or update obsolete `:create_ads_account` and `:send_account_invitation` tests

### Short-Term Actions (Improve Coverage)

- [ ] Add full deployment flow integration test
- [ ] Add error path tests with VCR cassettes
- [ ] Add idempotency tests for each step

### Long-Term Actions (Comprehensive Coverage)

- [ ] Add concurrent deploy stress tests
- [ ] Add performance/batching tests
- [ ] Document test patterns for future resources

---

## Part 5: Running Tests

### Run All Google Ads Tests

```bash
# Resource layer (should all pass)
bundle exec rspec spec/services/google_ads/resources/ --format documentation

# Deploy orchestration (currently 17 failures)
bundle exec rspec spec/models/campaign_deploy_spec.rb --format documentation

# All Google Ads related
bundle exec rspec spec/services/google_ads/ spec/models/campaign_deploy_spec.rb \
  spec/models/ads_account_spec.rb spec/models/ad_*.rb --format documentation
```

### Run Specific Step Tests

```bash
# Test just budget sync step
bundle exec rspec spec/models/campaign_deploy_spec.rb -e "sync_budget"

# Test location targeting
bundle exec rspec spec/models/campaign_deploy_spec.rb -e "create_geo_targeting"
```

---

## Conclusion

The Google Ads integration has **strong unit test coverage** at the resource layer (485 tests, 100% passing). The main work needed is:

1. **Fix 17 broken orchestration tests** - Mostly test/implementation mismatches
2. **Add missing model methods** - `google_sync_result` delegation
3. **Update factories** - Add required fields

The architecture is sound; the tests just need to be synchronized with recent implementation changes (removal of account/invitation steps from deploy flow).
