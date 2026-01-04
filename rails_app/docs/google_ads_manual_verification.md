# Google Ads API Manual Verification Guide

Step-by-step interactive verification of all Google Ads API integrations.

## Prerequisites

1. Log into https://ads.google.com with a **@launch10.ai** account
2. Select **Launch10 MCC Test Account (124-895-7009)**

---

## Step 0: Cleanup Old Test Accounts

Before running verification, clean up any old test accounts from previous runs.

### List existing accounts

```bash
cd rails_app
bundle exec ruby bin/cleanup_test_accounts.rb --list
bundle exec ruby bin/cleanup_test_accounts.rb --hide # use this
bundle exec ruby bin/cleanup_test_accounts.rb --unlink # this might be preferable for production, but we can't unlink test accounts, so we hide instead
```

This shows all accounts under the MCC with their status (🟢 ENABLED, 🔴 CANCELED/CLOSED).

### Option A: Hide old accounts (best for local development)

```bash
bundle exec ruby bin/cleanup_test_accounts.rb --hide
```

### Option B: Unlink accounts from MCC (recommended)

```bash
bundle exec ruby bin/cleanup_test_accounts.rb --unlink
```

- Completely removes accounts from MCC
- MCC account list will be empty
- Clean slate for testing

### Interactive mode

```bash
bundle exec ruby bin/cleanup_test_accounts.rb
```

Prompts you to choose between cancel or unlink.

**Verify in UI:**

- Visit https://ads.google.com/aw/accounts?ocid=1248957009
- After unlink: No accounts should appear under MCC
- After cancel: Accounts show as CANCELED/CLOSED

---

## Setup (run once)

```bash
cd rails_app
bundle exec rails console
```

Then in the console:

```ruby
Database::Snapshotter.restore_snapshot("campaign_complete");1
campaign = Campaign.last
runner = CampaignDeploy::StepRunner.new(campaign)
```

---

## CREATE Tests

### Step 1: Create Account

**Before:** Visit MCC → no new accounts

```ruby
runner.find(:create_ads_account).run
```

**Verify in UI:**

- Visit https://ads.google.com/aw/accounts?ocid=1248957009
- Look for new account (name starts with "Test Account YYYYMMDD_HHMMSS")
- Copy the new customer ID for subsequent verifications

---

### Step 2: Send Account Invitation

```ruby
runner.find(:send_account_invitation).run
```

**Verify:** Check email or invitation status in the account

---

### Step 3: Create Budget

```ruby
runner.find(:sync_budget).run
```

**Verify in UI:**

- Navigate to new customer account
- Campaign Settings → Budget should show $10.00/day

---

### Step 4: Create Campaign

```ruby
runner.find(:create_campaign).run
```

**Verify in UI:**

- `/aw/campaigns?ocid={customer_id}`
- "Test Campaign" should appear (Paused, Search type)

---

### Step 5: Create Location Targets

```ruby
runner.find(:create_geo_targeting).run
```

# Next tests:

- Create more specific targets

**Verify in UI:**

- `/aw/locations?ocid={customer_id}`
- Should show Los Angeles + New York

---

### Step 6: Create Ad Schedules

```ruby
runner.find(:create_schedule).run
```

Try again with specific data:

```ruby
campaign.update_ad_schedules(
    always_on: false,
    day_of_week: ['Monday', 'Tuesday'],
    start_time: '9:00am',
    end_time: '5:00pm',
    time_zone: 'America/New_York'
)

campaign = Campaign.last
runner = CampaignDeploy::StepRunner.new(campaign)
runner.find(:create_schedule).run
```

Then reset back to all the time:

```ruby
campaign.update_ad_schedules(
    always_on: true,
)
runner = CampaignDeploy::StepRunner.new(campaign)
runner.find(:create_schedule).run
```

**Verify in UI:**

- `/aw/adschedule?ocid={customer_id}`
- Should show Mon-Fri, 9am-5pm

---

### Step 7: Create Callouts

```ruby
runner.find(:create_callouts).run
```

- Next tests:
- Updates / deletes

**Verify in UI:**

- `/aw/assetreport/associations?assetType=callout`
- Should show 5 callouts linked to campaign

---

### Step 8: Create Structured Snippets

```ruby
runner.find(:create_structured_snippets).run
```

- Next tests:
- Updates / deletes

**Verify in UI:**

- `/aw/assetreport/associations?assetType=structuredsnippet`
- Should show "Brands: Type A, Type B, Type C, Type D"

---

### Step 9: Create Ad Groups

```ruby
runner.find(:create_ad_groups).run
```

**Verify in UI:**

- `/aw/adgroups?campaignId={campaign.google_campaign_id}&ocid={customer_id}`
- "Default Ad Group" should appear with status "Paused"

---

### Step 10: Create Keywords

```ruby
runner.find(:create_keywords).run
```

**Verify in UI:**

- `/aw/keywords?ocid={customer_id}`
- Should show 5 broad match keywords

---

### Step 11: Create Ads

```ruby
runner.find(:create_ads).run
```

**Verify in UI:**

- `/aw/ads?ocid={customer_id}`
- Should show 1 Responsive Search Ad

---

## UPDATE Tests

Run these after all CREATE tests complete.

### Update Budget ($25 → $15)

```ruby
budget = campaign.budget
budget.daily_budget_cents = 1500
budget.save!
GoogleAds::Budget.new(budget).sync
```

**Verify:** Campaign settings shows $15/day

- https://ads.google.com/aw/campaigns
- Click on campaign → Settings → Budget

---

### Update Account Descriptive Name

```ruby
ads_account = campaign.google_ads_account
ads_account.google_descriptive_name = "#{ads_account.google_descriptive_name} (Updated)"
ads_account.save!
GoogleAds::Account.new(ads_account).sync
```

**Verify:** MCC account list shows updated name

- https://ads.google.com/aw/accounts?ocid=1248957009

---

### Verify Account Auto-Tagging (enforced true)

Auto-tagging is enforced at the model layer and cannot be disabled (required for conversion tracking).

```ruby
ads_account = campaign.ads_account

# This should already be true by default
ads_account.google_auto_tagging_enabled
# => true

# Attempting to set false will fail validation
ads_account.google_auto_tagging_enabled = false
ads_account.valid?
# => false
ads_account.errors[:google_auto_tagging_enabled]
# => ["must be enabled for conversion tracking and analytics"]
```

**Verify in UI:** Account settings → Auto-tagging should always be enabled

- Navigate to account → Settings (gear icon) → Account settings → Auto-tagging

---

### Update Campaign Name

```ruby
campaign.reload
campaign.name = "#{campaign.name} (Updated)"
campaign.save!
GoogleAds::Campaign.new(campaign).sync
```

**Verify:** Campaign list shows updated name

- https://ads.google.com/aw/campaigns

---

### Update Campaign Status (PAUSED → ENABLED → PAUSED)

```ruby
campaign.reload
campaign.google_status = :ENABLED
campaign.save!
GoogleAds::Campaign.new(campaign).sync
```

**Verify:** Campaign status changes from "Paused" to "Enabled"

- https://ads.google.com/aw/campaigns

Then toggle back:

```ruby
campaign.reload
campaign.google_status = :PAUSED
campaign.save!
GoogleAds::Campaign.new(campaign).sync
```

**Verify:** Campaign status back to "Paused"

---

### Update Ad Group Name

```ruby
campaign.reload
ad_group = campaign.ad_groups.first
ad_group.name = "#{ad_group.name} (Updated)"
ad_group.save!
GoogleAds::AdGroup.new(ad_group).sync
```

**Verify:** Ad groups list shows updated name

- https://ads.google.com/aw/adgroups

---

### Update Ad Group Status (PAUSED → ENABLED → PAUSED)

```ruby
campaign.reload
ad_group = campaign.ad_groups.first
ad_group.google_status = :PAUSED # or ENABLED
ad_group.save!
GoogleAds::AdGroup.new(ad_group).sync
```

**Verify:** Ad group status changes from "Paused" to "Enabled"

- https://ads.google.com/aw/adgroups

Then toggle back:

```ruby
ad_group.reload
ad_group.google_status = :PAUSED
ad_group.save!
GoogleAds::AdGroup.new(ad_group).sync
```

**Verify:** Ad group status back to "Paused"

---

### Update Ad Group CPC Bid

```ruby
campaign.reload
ad_group = campaign.ad_groups.first
ad_group.google_cpc_bid_micros = 2_000_000  # $2.00
ad_group.save!
GoogleAds::AdGroup.new(ad_group).sync
```

**Verify:** Ad group shows max CPC bid of $2.00

- https://ads.google.com/aw/adgroups
- Click on the ad group → Settings → Default max CPC

---

### Update Ad Status

```ruby
campaign.reload
ad = campaign.ad_groups.first.ads.first
ad.status = ad.status == "active" ? "paused" : "active"
ad.save!
GoogleAds::Ad.new(ad).sync
```

**Verify:** Ads list shows toggled status

- https://ads.google.com/aw/ads
- Always put it back to paused afterwards

---

### Update Ad Display Paths

```ruby
campaign.reload
ad = campaign.ad_groups.first.ads.first
ad.display_path_1 = "products"
ad.display_path_2 = "sale"
ad.save!
GoogleAds::Ad.new(ad).sync
```

**Verify:** Ad preview shows display URL with paths

- https://ads.google.com/aw/ads
- Click on ad → Preview should show `yoursite.com/products/sale`

Reset paths:

```ruby
ad.reload
ad.display_path_1 = nil
ad.display_path_2 = nil
ad.save!
GoogleAds::Ad.new(ad).sync
```

**Verify:** Display URL paths cleared

---

## DELETE Tests

### Delete Location Target (Los Angeles)

```ruby
campaign.reload
location = campaign.location_targets.find_by(location_name: "Los Angeles")
location.destroy
GoogleAds::LocationTargets.new(campaign).sync
```

**Verify:** Locations page shows only New York (1 of 1)

---

### Delete Keyword

```ruby
campaign.reload
ad_group = campaign.ad_groups.first
keyword = ad_group.keywords.last
keyword.destroy
GoogleAds::Keywords.new(ad_group).sync
```

**Verify:** Keywords page shows 4 of 4

---

### Delete Callout (Unlink)

```ruby
campaign.reload
callout = campaign.callouts.last
callout.destroy
GoogleAds::Callouts.new(campaign).sync
```

**Verify:** Callouts count decreased by 1

---

### Delete Structured Snippet (Unlink)

```ruby
campaign.reload
snippet = campaign.structured_snippet
snippet.destroy
GoogleAds::StructuredSnippets.new(campaign).sync
```

**Verify:** Structured snippets shows "No assets match your filters"

---

### Delete Ad Schedule

```ruby
campaign.reload
schedule = campaign.ad_schedules.last
schedule.destroy
GoogleAds::AdSchedules.new(campaign).sync
```

**Verify:** Ad schedule shows 4 days instead of 5

---

## Destructive DELETE Tests (Optional)

These remove the entire resource hierarchy. Run only if you want to verify full deletion.

### Delete Ad

```ruby
campaign.reload
ad = campaign.ad_groups.first.ads.first
GoogleAds::Ad.new(ad).delete
ad.destroy
```

**Verify:** Ads page shows 0 ads

---

### Delete Ad Group

```ruby
campaign.reload
ad_group = campaign.ad_groups.first
ad_group.destroy
GoogleAds::AdGroup.new(ad_group).delete
```

**Verify:** Ad groups page shows 0 ad groups

---

### Delete Campaign

```ruby
campaign.reload
campaign.destroy
GoogleAds::Campaign.new(campaign).delete
```

**Verify:** Campaigns page shows 0 campaigns

---

### Delete Budget

```ruby
budget = campaign.budget
budget.destroy
GoogleAds::Budget.new(budget).delete
```

**Verify:** Budget removed from account

---

### Delete Account (Cancel)

```ruby
ads_account = Account.last.google_ads_account
GoogleAds::Account.new(ads_account).delete
```

**Verify:** Account status becomes CANCELED in MCC list

---

## Quick Reference URLs

Replace `{customer_id}` with your actual customer ID (e.g., `1495088796`):

| Resource     | URL                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------- |
| MCC Accounts | https://ads.google.com/aw/accounts?ocid=1248957009                                                |
| Campaigns    | https://ads.google.com/aw/campaigns?ocid={customer_id}                                            |
| Ad Groups    | https://ads.google.com/aw/adgroups?ocid={customer_id}                                             |
| Keywords     | https://ads.google.com/aw/keywords?ocid={customer_id}                                             |
| Ads          | https://ads.google.com/aw/ads?ocid={customer_id}                                                  |
| Locations    | https://ads.google.com/aw/locations?ocid={customer_id}                                            |
| Ad Schedule  | https://ads.google.com/aw/adschedule?ocid={customer_id}                                           |
| Callouts     | https://ads.google.com/aw/assetreport/associations?ocid={customer_id}&assetType=callout           |
| Snippets     | https://ads.google.com/aw/assetreport/associations?ocid={customer_id}&assetType=structuredsnippet |

---

## Notes

1. **Assets are immutable** - Callouts and Structured Snippets cannot be updated or deleted. We can only unlink them from campaigns.

2. **Keywords are immutable** - Text and match_type cannot be changed after creation. Must delete and recreate.

3. **Location targets are immutable** - geo_target_constant and negative fields cannot be changed. Must delete and recreate.

4. **Ad Schedules are immutable** - All schedule fields cannot be changed. Must delete and recreate.

5. **UI caching** - Google Ads UI aggressively caches. Use hard refresh (Cmd+Shift+R) or wait a few seconds if changes don't appear immediately.

6. **Test account limitations** - Assets may show "Pending Under review" status in test accounts. This is expected.

---

## Field Coverage Reference

All syncable fields from `GoogleAds::Sync::FieldMappings`:

| Resource                 | Mutable Fields                               | Immutable Fields                                                |
| ------------------------ | -------------------------------------------- | --------------------------------------------------------------- |
| **AdsAccount**           | `descriptive_name`, `auto_tagging_enabled`   | `currency_code`, `time_zone`                                    |
| **AdBudget**             | `daily_budget_cents`, `name`                 | -                                                               |
| **Campaign**             | `name`, `status`                             | `advertising_channel_type`, `contains_eu_political_advertising` |
| **AdGroup**              | `name`, `status`, `cpc_bid_micros`           | `type`                                                          |
| **Ad**                   | `status`, `display_path_1`, `display_path_2` | -                                                               |
| **AdKeyword**            | -                                            | `text`, `match_type` (delete/recreate)                          |
| **AdLocationTarget**     | -                                            | `geo_target_constant`, `negative` (delete/recreate)             |
| **AdSchedule**           | -                                            | all fields (delete/recreate)                                    |
| **AdCallout**            | -                                            | `text` (unlink/recreate)                                        |
| **AdStructuredSnippet**  | -                                            | `category`, `values` (unlink/recreate)                          |
| **AdsAccountInvitation** | -                                            | `email_address`, `access_role` (create only)                    |
