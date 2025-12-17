#!/usr/bin/env ruby
require_relative '../config/environment'

account = Account.first
GoogleAds::AccountManager.create_client_account(account)


