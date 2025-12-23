#!/usr/bin/env ruby
require "rubygems"
require "bundler/setup"
require_relative "../config/environment"

campaign = Campaign.last
runner = CampaignDeploy::StepRunner.new(campaign)
create_account = runner.find(:create_ads_account)
create_account.run
ads_account = Account.last.google_ads_account
binding.pry
account.send_google_ads_invitation_email

