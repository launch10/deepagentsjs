#!/usr/bin/env ruby
require_relative "../config/environment"

Database::Snapshotter.restore_snapshot("campaign_complete")

campaign = Campaign.last
account = campaign.account
ads_account = AdsAccount.find_or_create_by!(account: account, platform: "google")
ads_account.google_customer_id = "7067028496"
ads_account.save!

# First sync budget
budget_sync = GoogleAds::Budget.new(campaign.budget)
budget_sync.sync unless budget_sync.synced?
campaign.reload

puts "Budget synced: #{campaign.budget.google_budget_id}"

# Now debug the campaign sync
campaign_sync = GoogleAds::Campaign.new(campaign)

puts ""
puts "=== Campaign Sync Debug ==="
puts "local_resource: #{campaign_sync.local_resource.name}"
puts "remote_resource: #{campaign_sync.remote_resource.inspect}"
puts "synced?: #{campaign_sync.synced?}"
puts "sync_result: #{campaign_sync.sync_result.inspect}"
puts "sync_result.action: #{campaign_sync.sync_result.action}"

puts ""
puts "=== Calling sync() ==="
begin
  result = campaign_sync.sync
  puts "Result: #{result.inspect}"
  puts "Action: #{result.action}"
  puts "Success: #{result.success?}"

  campaign.reload
  puts ""
  puts "After sync:"
  puts "  google_campaign_id: #{campaign.google_campaign_id.inspect}"
rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
  puts "GoogleAdsError:"
  e.failure.errors.each do |error|
    puts "  Error code: #{error.error_code.to_h}"
    puts "  Message: #{error.message}"
  end
rescue => e
  puts "Error: #{e.class}: #{e.message}"
  puts e.backtrace.first(5).join("\n")
end
