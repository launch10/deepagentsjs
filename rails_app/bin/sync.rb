#!/usr/bin/env ruby
require "rubygems"
require "bundler/setup"
require_relative "../config/environment"

# Restore campaign_complete snapshot
puts "Restoring campaign_complete snapshot..."
Database::Snapshotter.restore_snapshot("campaign_complete")

campaign = Campaign.last
runner = CampaignDeploy::StepRunner.new(campaign)

puts "Creating account..."
create_account = runner.find(:create_ads_account)
create_account.run
# create_account.finished?

puts "Sending invitation..."
send_invitation = runner.find(:send_account_invitation)
send_invitation.run
# send_invitation.finished?

puts "Syncing budget..."
sync_budget = runner.find(:sync_budget)
sync_budget.run
# sync_budget.finished?

puts "Creating campaign..."
create_campaign = runner.find(:create_campaign)
create_campaign.run
# create_campaign.finished?

puts "Creating geo targets..."
create_geo_targets = runner.find(:create_geo_targeting)
create_geo_targets.run

# Delete location targets, add location targets, re-sync, test
puts "Deleting location targets..."
location_target = campaign.location_targets.find_by(location_name: "Los Angeles")
location_target.destroy if location_target

puts "Resyncing geo targets..."
create_geo_targets = runner.find(:create_geo_targeting)
create_geo_targets.finished? # should be false
create_geo_targets.run
create_geo_targets.finished? # should be true

puts "Creating schedule..."
create_schedule = runner.find(:create_schedule)
binding.pry
create_schedule.finished? # should be false
create_schedule.run
create_schedule.finished? # should be true

puts "Creating callouts..."
create_callouts = runner.find(:create_callouts)
create_callouts.finished? # should be false
create_callouts.run
create_callouts.finished? # should be true

puts "Creating structured snippets..."
create_structured_snippets = runner.find(:create_structured_snippets)
create_structured_snippets.finished? # should be false
create_structured_snippets.run
create_structured_snippets.finished? # should be true

puts "Creating ad groups..."
create_ad_groups = runner.find(:create_ad_groups)
create_ad_groups.finished? # should be false
create_ad_groups.run
create_ad_groups.finished? # should be true

puts "Creating keywords..."
create_keywords = runner.create(:create_keywords)
create_keywords.finished? # should be false
create_keywords.run
create_keywords.finished? # should be true

puts "Creating ads..."
create_ads = runner.create(:create_ads)
create_ads.finished? # should be false
create_ads.run
create_ads.finished? # should be true

# create_account.run
ads_account = Account.last.google_ads_account

# TODO: Test each step of the campaign deploy

# bundle exec rake db:restore_snapshot\[campaign_complete\]
# 1. We can create account - check
  # We can idempotently create account
  # We can confirm account is created
# 2. We can sent account invitation email - can't know?

# MCC Test Account: 124-895-7009
# __e = Our MCC Account
# authuser = Probably me?

# 149-508-8796
#  = https://ads.google.com/aw/overview?ocid=7879395008&ascid=7879395008&euid=1519816029&__u=2510653621&uscid=7850857179&__c=1415339971&authuser=2&__e=1248957009&subid=us-en-awhp-g-aw-c-home-signin-bgc%21o2-aluminum%7Cib%3A7219774260%7C-ahpm-0000000179-0000000001

# 965-209-9878
# =  https://ads.google.com/aw/overview?ocid=7879486011&ascid=7879486011&euid=1519816029&__u=2510653621&uscid=7850857179&__c=1415339971&authuser=2&__e=1248957009&subid=us-en-awhp-g-aw-c-home-signin-bgc%21o2-aluminum%7Cib%3A7219774260%7C-ahpm-0000000179-0000000001