#!/usr/bin/env ruby
require_relative "../config/environment"

Database::Snapshotter.restore_snapshot("campaign_complete")

campaign = Campaign.last
account = campaign.account
ads_account = AdsAccount.find_or_create_by!(account: account, platform: "google")
ads_account.google_customer_id = "7067028496"
ads_account.save!

budget = campaign.budget

puts "=== Budget State ==="
puts "Budget ID: #{budget.id}"
puts "google_budget_id: #{budget.google_budget_id.inspect}"
puts "daily_budget_cents: #{budget.daily_budget_cents}"
puts "campaign.google_customer_id: #{campaign.google_customer_id.inspect}"

budget_sync = GoogleAds::Budget.new(budget)

puts ""
puts "=== Budget Sync Debug ==="
puts "remote_resource: #{budget_sync.remote_resource.inspect}"
puts "synced?: #{budget_sync.synced?}"

puts ""
puts "=== Calling sync() ==="
begin
  result = budget_sync.sync
  puts "Result action: #{result.action}"
  puts "Success: #{result.success?}"

  budget.reload
  puts ""
  puts "After sync:"
  puts "  google_budget_id: #{budget.google_budget_id.inspect}"
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
