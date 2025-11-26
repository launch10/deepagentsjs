#!/usr/bin/env ruby
require_relative '../config/environment'

manager_customer_id = ENV['GOOGLE_ADS_MANAGER_ID']&.tr('-', '')

unless manager_customer_id
  puts "ERROR: Set GOOGLE_ADS_MANAGER_ID environment variable"
  puts "Example: GOOGLE_ADS_MANAGER_ID=123-456-7890 bin/rails runner scripts/create_google_ads_client_account.rb"
  exit 1
end

puts "Creating client account under Manager Account: #{manager_customer_id}"

config_path = Rails.root.join('config', 'initializers', 'google_ads.rb')
client = Google::Ads::GoogleAds::GoogleAdsClient.new(config_path.to_s)

customer = client.resource.customer do |c|
  c.descriptive_name = "Launch10 Test Account
#{Time.current.to_i}"
  c.currency_code = "USD"
  c.time_zone = "America/New_York"
end

puts 'Creating client account...'
client.service.customer.create_customer_client(
  customer_id: manager_customer_id,
  customer_client: customer
)

begin
  response = client.service.customer.create_customer_client(
    customer_id: manager_customer_id,
    customer_client: customer_operation
  )

  new_customer_id = response.resource_name.split('/').last

  puts "\nSUCCESS!"
  puts "=" * 50
  puts "New Client Account ID: #{new_customer_id}"
  puts "Formatted: #{new_customer_id.gsub(/(\d{3})(\d{3})(\d{4})/, '\1-\2-\3')}"
  puts "=" * 50
  puts "\nUse this ID for your campaigns:"
  puts "export GOOGLE_ADS_CUSTOMER_ID=#{new_customer_id}"
rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
  puts "\nFAILED!"
  e.failure.errors.each do |error|
    puts "Error: #{error.message}"
    error.error_code.to_h.each do |k, v|
      next if v == :UNSPECIFIED
      puts "  #{k}: #{v}"
    end
  end
rescue => e
  puts "\nFAILED: #{e.message}"
end
