#!/usr/bin/env ruby
require_relative '../config/environment'

puts "=== Google Ads Auth Test ==="
puts

creds = Rails.application.credentials.google_ads
puts "Credentials loaded:"
puts "  client_id:       #{creds[:client_id] ? creds[:client_id][0..20] + "..." : "MISSING"}"
puts "  client_secret:   #{creds[:client_secret] ? "***" + creds[:client_secret][-4..] : "MISSING"}"
puts "  refresh_token:   #{creds[:refresh_token] ? "***" + creds[:refresh_token][-10..] : "MISSING"}"
puts "  developer_token: #{creds[:developer_token] ? "***" + creds[:developer_token][-4..] : "MISSING"}"
puts "  login_customer_id: #{ENV["GOOGLE_ADS_MANAGER_ID"] || creds[:login_customer_id] || "MISSING"}"
puts

config_path = Rails.root.join('config', 'initializers', 'google_ads.rb')
client = Google::Ads::GoogleAds::GoogleAdsClient.new(config_path.to_s)

customer_id = ENV['GOOGLE_ADS_MANAGER_ID']&.tr('-', '') || creds[:login_customer_id]

puts "Testing API access with customer_id: #{customer_id}"
puts

begin
  response = client.service.google_ads.search(
    customer_id: customer_id,
    query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1"
  )

  response.each do |row|
    puts "SUCCESS! Connected to:"
    puts "  Customer ID: #{row.customer.id}"
    puts "  Name: #{row.customer.descriptive_name}"
  end
rescue Google::Ads::GoogleAds::Errors::GoogleAdsError => e
  puts "Google Ads API Error:"
  e.failure.errors.each do |error|
    puts "  #{error.message}"
    error.error_code.to_h.each { |k, v| puts "    #{k}: #{v}" unless v == :UNSPECIFIED }
  end
rescue GRPC::Unavailable => e
  puts "Auth Error: #{e.message}"
  puts
  puts "Your refresh_token is likely invalid or expired."
  puts "Generate a new one at:"
  puts "  https://developers.google.com/oauthplayground/"
  puts
  puts "Steps:"
  puts "1. Click gear icon -> Check 'Use your own OAuth credentials'"
  puts "2. Enter your client_id and client_secret"
  puts "3. In left panel, find 'Google Ads API v22' and select scope:"
  puts "   https://www.googleapis.com/auth/adwords"
  puts "4. Click 'Authorize APIs' and grant access"
  puts "5. Click 'Exchange authorization code for tokens'"
  puts "6. Copy the refresh_token to your Rails credentials"
rescue => e
  puts "Error: #{e.class} - #{e.message}"
end
