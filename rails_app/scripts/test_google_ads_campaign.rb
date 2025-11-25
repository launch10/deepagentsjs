#!/usr/bin/env ruby
require_relative '../config/environment'

puts "Creating test Google Ads campaign..."

account = Account.first || Account.create!(name: "Test Account")
user = User.first || User.create!(
  email: "test@example.com",
  password: "password123",
  first_name: "Test",
  last_name: "User"
)
account.account_users.find_or_create_by!(user: user) do |au|
  au.roles = { admin: true }
end

project = Project.find_or_create_by!(account: account, name: "Test Ads Project")

website = Website.find_or_create_by!(account: account, project: project, name: "test-ads-site") do |w|
  w.theme_id = Theme.first&.id
end

puts "Account: #{account.name} (ID: #{account.id})"
puts "Website: #{website.name} (ID: #{website.id})"

campaign_data = Campaign.create_campaign!(account, {
  name: "Test Google Ads Campaign #{Time.current.to_i}",
  website_id: website.id,
  project_id: project.id
})

campaign = campaign_data[:campaign]
ad_group = campaign_data[:ad_group]
ad = campaign_data[:ad]

puts "Created Campaign: #{campaign.name} (ID: #{campaign.id})"
puts "Created Ad Group: #{ad_group.name} (ID: #{ad_group.id})"
puts "Created Ad: (ID: #{ad.id})"

puts "\n--- Stage 1: Content Stage ---"
puts "Creating 5 headlines..."
5.times do |i|
  ad.headlines.create!(
    text: "Amazing Product Headline #{i + 1}",
    position: i + 1
  )
end

puts "Creating 3 descriptions..."
ad.descriptions.create!(text: "Discover our incredible solution that saves you time and money.", position: 1)
ad.descriptions.create!(text: "Join thousands of satisfied customers today.", position: 2)
ad.descriptions.create!(text: "Free shipping on all orders. Shop now!", position: 3)

puts "Headlines: #{ad.headlines.count}, Descriptions: #{ad.descriptions.count}"
puts "Content stage valid: #{campaign.done_content_stage?}"
campaign.advance_stage!
puts "Advanced to: #{campaign.stage}"

puts "\n--- Stage 2: Highlights Stage ---"
puts "Creating 4 callouts..."
["Free Shipping", "24/7 Support", "Money Back Guarantee", "Fast Delivery"].each_with_index do |text, i|
  AdCallout.create!(
    campaign: campaign,
    ad_group: ad_group,
    text: text,
    position: i + 1
  )
end

puts "Creating structured snippet..."
AdStructuredSnippet.create!(
  campaign: campaign,
  category: "services",
  values: ["Consulting", "Implementation", "Support", "Training"]
)

puts "Callouts: #{campaign.callouts.count}"
puts "Highlights stage valid: #{campaign.done_highlights_stage?}"
campaign.advance_stage!
puts "Advanced to: #{campaign.stage}"

puts "\n--- Stage 3: Keywords Stage ---"
puts "Creating 8 keywords..."
keywords = [
  "best product online",
  "affordable solution",
  "top rated service",
  "buy product now",
  "premium quality items",
  "discount deals today",
  "trusted brand reviews",
  "fast shipping products"
]

keywords.each_with_index do |keyword_text, i|
  ad_group.keywords.create!(
    text: keyword_text,
    match_type: %w[broad phrase exact][i % 3],
    position: i + 1
  )
end

puts "Keywords: #{ad_group.keywords.count}"
puts "Keywords stage valid: #{campaign.done_keywords_stage?}"
campaign.advance_stage!
puts "Advanced to: #{campaign.stage}"

puts "\n--- Stage 4: Settings Stage ---"
puts "Setting budget..."
campaign.create_budget!(daily_budget_cents: 2000)

puts "Setting ad schedules..."
campaign.update_ad_schedules(
  time_zone: "America/New_York",
  always_on: true
)

puts "Setting location targeting..."
campaign.update_location_targets([
  {
    target_type: "geo_location",
    location_name: "United States",
    location_type: "COUNTRY",
    country_code: "US",
    geo_target_constant: "geoTargetConstants/2840",
    targeted: true
  }
])

puts "Budget: $#{campaign.daily_budget_cents / 100.0}/day"
puts "Schedules: #{campaign.ad_schedules.count}"
puts "Location targets: #{campaign.location_targets.count}"
puts "Settings stage valid: #{campaign.done_settings_stage?}"
campaign.advance_stage!
puts "Advanced to: #{campaign.stage}"

puts "\n--- Stage 5: Launch Stage ---"
puts "Configuring Google Ads settings..."
campaign.update!(
  google_advertising_channel_type: "SEARCH",
  google_bidding_strategy: "MAXIMIZE_CLICKS",
  start_date: Date.tomorrow,
  end_date: Date.today + 1.month,
  google_target_google_search: true,
  google_target_search_network: false,
  google_target_content_network: false,
  google_target_partner_search_network: false
)

puts "Adding language targeting..."
campaign.languages.create!(google_language: "english")

puts "Launch stage valid: #{campaign.done_launch_stage?}"

puts "\n" + "=" * 60
puts "CAMPAIGN READY FOR LAUNCH"
puts "=" * 60
puts "Campaign ID: #{campaign.id}"
puts "Campaign Name: #{campaign.name}"
puts "Stage: #{campaign.stage}"
puts "Channel Type: #{campaign.google_advertising_channel_type}"
puts "Bidding Strategy: #{campaign.google_bidding_strategy}"
puts "Daily Budget: $#{campaign.daily_budget_cents / 100.0}"
puts "Start Date: #{campaign.start_date}"
puts "End Date: #{campaign.end_date}"
puts "Languages: #{campaign.languages.map(&:google_language).join(', ')}"
puts "Location Targets: #{campaign.location_targets.map(&:location_name).join(', ')}"
puts "Headlines: #{ad.headlines.count}"
puts "Descriptions: #{ad.descriptions.count}"
puts "Keywords: #{ad_group.keywords.count}"
puts "Callouts: #{campaign.callouts.count}"
puts "=" * 60

puts "\n--- Launching Campaign via Google Ads API ---"
service = GoogleAds::LaunchCampaignService.new(campaign)
result = service.call

if result.success?
  puts "\nSUCCESS!"
  puts "Google Customer ID: #{campaign.google_customer_id}"
  puts "Google Campaign ID: #{campaign.google_campaign_id}"
  puts "Google Budget ID: #{campaign.google_budget_id}"
  puts "Google Ad Group ID: #{ad_group.reload.google_ad_group_id}"
  puts "Google Ad ID: #{ad.reload.google_ad_id}"
else
  puts "\nFAILED!"
  puts "Error: #{result.error}"
  if result.errors.any?
    puts "Details:"
    result.errors.each { |e| puts "  - #{e}" }
  end
end
