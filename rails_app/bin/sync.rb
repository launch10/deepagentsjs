#!/usr/bin/env ruby
require "rubygems"
require "bundler/setup"
require_relative "../config/environment"

GoogleAds::Budget.new(Campaign.last).sync