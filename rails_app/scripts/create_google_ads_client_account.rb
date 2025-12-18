#!/usr/bin/env ruby
require_relative '../config/environment'

account = Account.first
account.create_google_ads_account
