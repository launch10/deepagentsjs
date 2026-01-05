#!/usr/bin/env ruby
# Google Ads API End-to-End Verification Script
#
# This script tests the complete Google Ads integration flow:
# 1. CREATE: Account, Budget, Campaign, Ad Groups, Ads, Keywords, etc.
# 2. UPDATE: Account, Budget, Campaign, Ad Group, Ad changes
# 3. DELETE: Location target, Keyword, Callout, Ad Schedule, Ad, Ad Group, Campaign, Budget, Account
#
# For each integration, we test CREATE, UPDATE (if applicable), and DELETE.
# Some resources have immutable fields (Keywords, LocationTargets) - UPDATE is skipped for these.
# Destructive DELETE tests run at the end (Ad, AdGroup, Campaign, Budget, Account).
#
# Usage:
#   bundle exec ruby bin/sync.rb
#
# Prerequisites:
#   - campaign_complete database snapshot must exist
#   - Google Ads API credentials configured
#
# Test MCC Account: 124-895-7009

require "rubygems"
require "bundler/setup"
require_relative "../config/environment"

class GoogleAdsE2ETest
  attr_reader :campaign, :runner, :results

  def initialize
    @results = []
  end

  def run
    puts "\n" + "=" * 60
    puts "Google Ads API End-to-End Verification"
    puts "=" * 60

    setup_test_data
    run_create_tests
    run_update_tests
    run_delete_tests
    print_summary
  end

  private

  def setup_test_data
    puts "\n[Setup] Restoring campaign_complete snapshot..."
    Database::Snapshotter.restore_snapshot("campaign_complete")
    @campaign = Campaign.last
    @runner = CampaignDeploy::StepRunner.new(@campaign)
    puts "[Setup] Using campaign: #{@campaign.name}"
  end

  def run_create_tests
    puts "\n" + "-" * 40
    puts "CREATE Tests"
    puts "-" * 40

    test_step(:create_ads_account, "Account Creation")
    test_step(:send_account_invitation, "Account Invitation")
    test_step(:sync_budget, "Budget Creation")
    test_step(:create_campaign, "Campaign Creation")
    test_step(:create_geo_targeting, "Location Targets")
    test_step(:create_schedule, "Ad Schedules")
    test_step(:create_callouts, "Callouts")
    test_step(:create_structured_snippets, "Structured Snippets")
    test_step(:create_ad_groups, "Ad Groups")
    test_step(:create_keywords, "Keywords")
    test_step(:create_ads, "Ads")
  end

  def run_update_tests
    puts "\n" + "-" * 40
    puts "UPDATE Tests"
    puts "-" * 40

    test_account_update
    test_budget_update
    test_campaign_update
    test_ad_group_update
    test_location_target_update
    test_keyword_update
    test_ad_update
  end

  def run_delete_tests
    puts "\n" + "-" * 40
    puts "DELETE Tests"
    puts "-" * 40

    # Non-destructive deletes (individual items)
    test_location_target_delete
    test_keyword_delete
    test_callout_delete
    test_structured_snippet_delete
    test_ad_schedule_delete

    # Destructive deletes (order matters - from least to most destructive)
    test_ad_delete
    test_ad_group_delete
    test_campaign_delete
    test_budget_delete
    test_account_delete
  end

  def test_step(step_name, description)
    print "  #{description}... "
    begin
      step = @runner.find(step_name)
      step.run
      if step.finished?
        record_result(description, :passed)
        puts "✅ PASSED"
      else
        record_result(description, :failed, "Step did not finish")
        puts "❌ FAILED (not finished)"
      end
    rescue => e
      record_result(description, :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_account_update
    print "  Account Name Update... "
    begin
      ads_account = Account.last.google_ads_account

      unless ads_account&.google_customer_id
        record_result("Account Update", :skipped, "No ads account")
        puts "⏭️  SKIPPED (no ads account)"
        return
      end

      original_name = ads_account.google_descriptive_name
      new_name = "#{original_name} (Updated)"

      ads_account.google_descriptive_name = new_name
      ads_account.save!

      syncer = GoogleAds::Resources::Account.new(ads_account)
      result = syncer.sync

      # Verify via API
      remote = syncer.fetch
      if remote && remote.descriptive_name == new_name
        record_result("Account Update", :passed)
        puts "✅ PASSED (remote: #{remote.descriptive_name})"
      else
        record_result("Account Update", :failed, "Remote mismatch")
        puts "❌ FAILED (remote: #{remote&.descriptive_name})"
      end
    rescue => e
      record_result("Account Update", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_budget_update
    print "  Budget Update ($10 -> $15)... "
    begin
      budget = @campaign.budget

      # Update to $15/day
      budget.daily_budget_cents = 1500
      budget.save!

      syncer = GoogleAds::Resources::Budget.new(budget)
      syncer.sync

      # Verify via API
      remote = syncer.fetch
      if remote && remote.amount_micros == 15_000_000
        record_result("Budget Update", :passed)
        puts "✅ PASSED (remote: $#{remote.amount_micros / 1_000_000.0}/day)"
      else
        record_result("Budget Update", :failed, "Remote mismatch")
        puts "❌ FAILED (remote: #{remote&.amount_micros})"
      end
    rescue => e
      record_result("Budget Update", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_campaign_update
    print "  Campaign Name Update... "
    begin
      @campaign.reload
      original_name = @campaign.name
      new_name = "#{original_name} (Updated)"

      @campaign.name = new_name
      @campaign.save!

      syncer = GoogleAds::Campaign.new(@campaign)
      result = syncer.sync

      # Verify via API
      remote = syncer.send(:fetch_remote)
      if remote && remote.name == new_name
        record_result("Campaign Update", :passed)
        puts "✅ PASSED (remote: #{remote.name})"
      else
        record_result("Campaign Update", :failed, "Remote mismatch")
        puts "❌ FAILED (remote: #{remote&.name})"
      end
    rescue => e
      record_result("Campaign Update", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_ad_group_update
    print "  Ad Group Name Update... "
    begin
      @campaign.reload
      ad_group = @campaign.ad_groups.first

      unless ad_group
        record_result("Ad Group Update", :skipped, "No ad groups")
        puts "⏭️  SKIPPED (no ad groups)"
        return
      end

      original_name = ad_group.name
      new_name = "#{original_name} (Updated)"

      ad_group.name = new_name
      ad_group.save!

      syncer = GoogleAds::Resources::AdGroup.new(ad_group)
      result = syncer.sync

      # Verify via API
      remote = syncer.fetch
      if remote && remote.name == new_name
        record_result("Ad Group Update", :passed)
        puts "✅ PASSED (remote: #{remote.name})"
      else
        record_result("Ad Group Update", :failed, "Remote mismatch")
        puts "❌ FAILED (remote: #{remote&.name})"
      end
    rescue => e
      record_result("Ad Group Update", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_location_target_update
    # NOTE: In Google Ads API, location target fields are IMMUTABLE
    # geo_target_constant and negative cannot be changed after creation
    # Must delete and recreate to change targeting mode
    print "  Location Target Update... "
    record_result("Location Target Update", :skipped, "All location target fields are immutable")
    puts "⏭️  SKIPPED (geo_target/negative immutable in Google Ads)"
  end

  def test_keyword_update
    # NOTE: In Google Ads API, keyword text and match_type are IMMUTABLE
    # They cannot be changed after creation - must delete and recreate
    # Status is not stored locally either, so there's nothing to test for updates
    print "  Keyword Update... "
    record_result("Keyword Update", :skipped, "All keyword fields are immutable")
    puts "⏭️  SKIPPED (text/match_type immutable in Google Ads)"
  end

  def test_ad_update
    print "  Ad Status Update... "
    begin
      @campaign.reload
      ad_group = @campaign.ad_groups.first
      ad = ad_group&.ads&.first

      unless ad
        record_result("Ad Update", :skipped, "No ads")
        puts "⏭️  SKIPPED (no ads)"
        return
      end

      original_status = ad.status
      new_status = original_status == "active" ? "paused" : "active"

      ad.status = new_status
      ad.save!

      syncer = GoogleAds::Resources::Ad.new(ad)
      result = syncer.sync

      # Verify via API
      remote = syncer.fetch
      expected_google_status = new_status == "active" ? :ENABLED : :PAUSED

      if remote && remote.status == expected_google_status
        record_result("Ad Update", :passed)
        puts "✅ PASSED (remote: #{remote.status})"
      else
        record_result("Ad Update", :failed, "Remote mismatch")
        puts "❌ FAILED (expected: #{expected_google_status}, got: #{remote&.status})"
      end
    rescue => e
      record_result("Ad Update", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_location_target_delete
    print "  Location Target Delete... "
    begin
      @campaign.reload
      location = @campaign.location_targets.find_by(location_name: "Los Angeles")

      unless location
        record_result("Location Target Delete", :skipped, "No Los Angeles target")
        puts "⏭️  SKIPPED (no Los Angeles target)"
        return
      end

      original_criterion_id = location.google_remote_criterion_id
      location.destroy

      syncer = GoogleAds::LocationTargets.new(@campaign)
      syncer.sync

      location.reload
      if location.google_remote_criterion_id.nil?
        record_result("Location Target Delete", :passed)
        puts "✅ PASSED (remote_criterion_id cleared)"
      else
        record_result("Location Target Delete", :failed, "remote_criterion_id not cleared")
        puts "❌ FAILED (remote_criterion_id: #{location.google_remote_criterion_id})"
      end
    rescue => e
      record_result("Location Target Delete", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_keyword_delete
    print "  Keyword Delete... "
    begin
      @campaign.reload
      ad_group = @campaign.ad_groups.first
      keyword = ad_group&.keywords&.last  # Use last to preserve one for update test

      unless keyword
        record_result("Keyword Delete", :skipped, "No keywords")
        puts "⏭️  SKIPPED (no keywords)"
        return
      end

      keyword_text = keyword.text
      keyword.destroy

      syncer = GoogleAds::Keywords.new(ad_group)
      syncer.sync

      keyword.reload
      if keyword.google_criterion_id.nil?
        record_result("Keyword Delete", :passed)
        puts "✅ PASSED (#{keyword_text} - criterion_id cleared)"
      else
        record_result("Keyword Delete", :failed, "criterion_id not cleared")
        puts "❌ FAILED (criterion_id: #{keyword.google_criterion_id})"
      end
    rescue => e
      record_result("Keyword Delete", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_callout_delete
    print "  Callout Delete (Unlink)... "
    begin
      @campaign.reload
      callout = @campaign.callouts.last  # Use last to preserve some

      unless callout
        record_result("Callout Delete", :skipped, "No callouts")
        puts "⏭️  SKIPPED (no callouts)"
        return
      end

      callout_text = callout.text
      callout.destroy

      syncer = GoogleAds::Callouts.new(@campaign)
      syncer.sync

      callout.reload
      if callout.google_asset_id.nil?
        record_result("Callout Delete", :passed)
        puts "✅ PASSED (#{callout_text} - asset_id cleared)"
      else
        record_result("Callout Delete", :failed, "asset_id not cleared")
        puts "❌ FAILED (asset_id: #{callout.google_asset_id})"
      end
    rescue => e
      record_result("Callout Delete", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_structured_snippet_delete
    print "  Structured Snippet Delete (Unlink)... "
    begin
      @campaign.reload
      snippet = @campaign.structured_snippet  # Campaign has_one :structured_snippet

      unless snippet
        record_result("Structured Snippet Delete", :skipped, "No structured snippet")
        puts "⏭️  SKIPPED (no structured snippet)"
        return
      end

      snippet_header = snippet.category
      snippet.destroy

      syncer = GoogleAds::StructuredSnippets.new(@campaign)
      syncer.sync

      snippet.reload
      if snippet.google_asset_id.nil?
        record_result("Structured Snippet Delete", :passed)
        puts "✅ PASSED (#{snippet_header} - asset_id cleared)"
      else
        record_result("Structured Snippet Delete", :failed, "asset_id not cleared")
        puts "❌ FAILED (asset_id: #{snippet.google_asset_id})"
      end
    rescue => e
      record_result("Structured Snippet Delete", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_ad_schedule_delete
    print "  Ad Schedule Delete... "
    begin
      @campaign.reload
      schedule = @campaign.ad_schedules.last  # Use last to preserve some

      unless schedule
        record_result("Ad Schedule Delete", :skipped, "No schedules")
        puts "⏭️  SKIPPED (no schedules)"
        return
      end

      day = schedule.day_of_week
      schedule.destroy

      GoogleAds::Resources::AdSchedule.sync_all(@campaign)

      schedule.reload
      if schedule.google_criterion_id.nil?
        record_result("Ad Schedule Delete", :passed)
        puts "✅ PASSED (#{day} - criterion_id cleared)"
      else
        record_result("Ad Schedule Delete", :failed, "criterion_id not cleared")
        puts "❌ FAILED (criterion_id: #{schedule.google_criterion_id})"
      end
    rescue => e
      record_result("Ad Schedule Delete", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_ad_delete
    print "  Ad Delete... "
    begin
      @campaign.reload
      ad_group = @campaign.ad_groups.first
      ad = ad_group&.ads&.first

      unless ad&.google_ad_id
        record_result("Ad Delete", :skipped, "No ads with remote ID")
        puts "⏭️  SKIPPED (no ads with remote ID)"
        return
      end

      ad_name = ad.headlines.first&.text || "Ad"

      # Delete from Google first (this clears google_ad_id and saves the record)
      syncer = GoogleAds::Resources::Ad.new(ad)
      syncer.delete

      # Then soft-delete locally
      ad.destroy

      ad.reload
      if ad.google_ad_id.nil?
        record_result("Ad Delete", :passed)
        puts "✅ PASSED (#{ad_name} - google_ad_id cleared)"
      else
        record_result("Ad Delete", :failed, "google_ad_id not cleared")
        puts "❌ FAILED (google_ad_id: #{ad.google_ad_id})"
      end
    rescue => e
      record_result("Ad Delete", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_ad_group_delete
    print "  Ad Group Delete... "
    begin
      @campaign.reload
      ad_group = @campaign.ad_groups.first

      unless ad_group&.google_ad_group_id
        record_result("Ad Group Delete", :skipped, "No ad groups with remote ID")
        puts "⏭️  SKIPPED (no ad groups with remote ID)"
        return
      end

      ad_group_name = ad_group.name
      ad_group.destroy

      syncer = GoogleAds::Resources::AdGroup.new(ad_group)
      syncer.delete

      ad_group.reload
      if ad_group.google_ad_group_id.nil?
        record_result("Ad Group Delete", :passed)
        puts "✅ PASSED (#{ad_group_name} - ad_group_id cleared)"
      else
        record_result("Ad Group Delete", :failed, "ad_group_id not cleared")
        puts "❌ FAILED (ad_group_id: #{ad_group.google_ad_group_id})"
      end
    rescue => e
      record_result("Ad Group Delete", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_campaign_delete
    print "  Campaign Delete... "
    begin
      @campaign.reload

      unless @campaign.google_campaign_id
        record_result("Campaign Delete", :skipped, "No campaign with remote ID")
        puts "⏭️  SKIPPED (no campaign with remote ID)"
        return
      end

      campaign_name = @campaign.name
      @campaign.destroy

      syncer = GoogleAds::Campaign.new(@campaign)
      syncer.delete

      @campaign.reload
      if @campaign.google_campaign_id.nil?
        record_result("Campaign Delete", :passed)
        puts "✅ PASSED (#{campaign_name} - campaign_id cleared)"
      else
        record_result("Campaign Delete", :failed, "campaign_id not cleared")
        puts "❌ FAILED (campaign_id: #{@campaign.google_campaign_id})"
      end
    rescue => e
      record_result("Campaign Delete", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_budget_delete
    print "  Budget Delete... "
    begin
      budget = @campaign.budget

      unless budget&.google_budget_id
        record_result("Budget Delete", :skipped, "No budget with remote ID")
        puts "⏭️  SKIPPED (no budget with remote ID)"
        return
      end

      budget_name = budget.google_budget_name
      budget.destroy

      syncer = GoogleAds::Resources::Budget.new(budget)
      syncer.delete

      budget.reload
      if budget.google_budget_id.nil?
        record_result("Budget Delete", :passed)
        puts "✅ PASSED (#{budget_name} - budget_id cleared)"
      else
        record_result("Budget Delete", :failed, "budget_id not cleared")
        puts "❌ FAILED (budget_id: #{budget.google_budget_id})"
      end
    rescue => e
      record_result("Budget Delete", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def test_account_delete
    print "  Account Delete (CANCELED)... "
    begin
      ads_account = Account.last.google_ads_account

      unless ads_account&.google_customer_id
        record_result("Account Delete", :skipped, "No ads account")
        puts "⏭️  SKIPPED (no ads account)"
        return
      end

      syncer = GoogleAds::Resources::Account.new(ads_account)
      result = syncer.delete  # Use delete method, not sync

      # Verify local state was updated
      ads_account.reload
      # Account delete sets status to CANCELED locally, but Google returns CLOSED for canceled accounts
      if ads_account.google_status == "CANCELED" && ads_account.google_customer_id.nil?
        record_result("Account Delete", :passed)
        puts "✅ PASSED (local status: CANCELED, customer_id cleared)"
      else
        record_result("Account Delete", :failed, "Local state not updated correctly")
        puts "❌ FAILED (status: #{ads_account.google_status}, customer_id: #{ads_account.google_customer_id})"
      end
    rescue => e
      record_result("Account Delete", :failed, e.message)
      puts "❌ FAILED (#{e.message})"
    end
  end

  def record_result(test_name, status, message = nil)
    @results << { name: test_name, status: status, message: message }
  end

  def print_summary
    puts "\n" + "=" * 60
    puts "Summary"
    puts "=" * 60

    passed = @results.count { |r| r[:status] == :passed }
    failed = @results.count { |r| r[:status] == :failed }
    skipped = @results.count { |r| r[:status] == :skipped }
    total = @results.length

    puts "  Passed:  #{passed}/#{total}"
    puts "  Failed:  #{failed}/#{total}"
    puts "  Skipped: #{skipped}/#{total}"

    if failed > 0
      puts "\nFailed Tests:"
      @results.select { |r| r[:status] == :failed }.each do |r|
        puts "  ❌ #{r[:name]}: #{r[:message]}"
      end
    end

    puts "\n" + "=" * 60
    if failed == 0
      puts "✅ All tests passed!"
    else
      puts "❌ #{failed} test(s) failed"
    end
    puts "=" * 60

    # Return URLs for manual verification
    ads_account = Account.last.google_ads_account
    if ads_account&.google_customer_id
      customer_id = ads_account.google_customer_id
      puts "\nManual Verification URLs:"
      puts "  Campaigns: https://ads.google.com/aw/campaigns?ocid=#{customer_id}"
      puts "  Ad Groups: https://ads.google.com/aw/adgroups?ocid=#{customer_id}"
      puts "  Keywords:  https://ads.google.com/aw/keywords?ocid=#{customer_id}"
      puts "  Assets:    https://ads.google.com/aw/assetreport/associations?ocid=#{customer_id}"
    end
  end
end

# Run the test
GoogleAdsE2ETest.new.run
