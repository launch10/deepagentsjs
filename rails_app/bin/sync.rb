#!/usr/bin/env ruby
require "rubygems"
require "bundler/setup"
require_relative "../config/environment"

campaign = Campaign.last
runner = CampaignDeploy::StepRunner.new(campaign)
create_account = runner.find(:create_ads_account)
create_account.run

binding.pry
sync_budget = runner.find(:sync_budget)
sync_budget.finished?
