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
location_target = campaign.location_targets.find_by(location_name: "Los Angeles")
location_target.destroy if location_target

create_geo_targets = runner.reload.find(:create_geo_targeting)
binding.pry
create_geo_targets.finished?
create_geo_targets.run

create_geo_targets = runner.reload.find(:create_geo_targeting)

expect(create_geo_targets.finished?).to be(false)

# Re-sync location targets
create_geo_targets.finished?

binding.pry

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