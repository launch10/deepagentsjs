#!/usr/bin/env ruby
require "rubygems"
require "bundler/setup"
require_relative "../config/environment"

campaign = Campaign.last
runner = CampaignDeploy::StepRunner.new(campaign)

create_account = runner.find(:create_ads_account)
create_account.run
# create_account.finished?

send_invitation = runner.find(:send_account_invitation)
send_invitation.run
# send_invitation.finished?

sync_budget = runner.find(:sync_budget)
sync_budget.run
# sync_budget.finished?

create_campaign = runner.find(:create_campaign)
create_campaign.run
# create_campaign.finished?

binding.pry

# create_account.run
ads_account = Account.last.google_ads_account

# TODO: Test each step of the campaign deploy

# bundle exec rake db:restore_snapshot\[campaign_complete\]
# 1. We can create account - check
  # We can idempotently create account
  # We can confirm account is created
# 2. We can sent account invitation email - can't know?