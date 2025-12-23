class CampaignComplete < BaseBuilder
  def base_snapshot
    "website_deployed"
  end

  def output_name
    "campaign_complete"
  end

  def build
    account = Account.first
    raise "No account found" unless account

    create_google_connected_account(account)

    project = account.projects.first
    raise "No project found for account #{account.id}" unless project

    website = project.website
    raise "No website found for project #{project.id}" unless website

    website_url = website.website_urls.first
    raise "No website_url found for website #{website.id}" unless website_url

    upload = create_favicon(account, website)
    campaign = create_campaign(account, project, website)
    create_budget(campaign)
    create_geo_targets(campaign)
    create_ad_schedules(campaign)
    ad_group = campaign.ad_groups.first
    create_assets(campaign, ad_group)
    create_keywords(ad_group)
    create_ad_content(ad_group)

    print_summary(account, project, website, website_url, upload, campaign)

    campaign
  end

  private

  def create_google_connected_account(account)
    user = account.owner
    raise "No owner found for account #{account.id}" unless user

    return if user.connected_accounts.exists?(provider: "google_oauth2")

    create(:connected_account, :google, owner: user, auth: {
      "info" => {
        "email" => "brett@launch10.ai",
        "name" => user.name
      }
    })
  end

  def create_favicon(account, website)
    upload = create(:upload, account: account, is_logo: true)
    create(:website_upload, website: website, upload: upload)
    upload
  end

  def create_campaign(account, project, website)
    result = Campaign.create_campaign!(account, {
      name: "Test Campaign",
      project_id: project.id,
      website_id: website.id
    })
    campaign = result[:campaign]
    campaign.start_date = Date.today
    campaign.google_bidding_strategy = :MAXIMIZE_CLICKS
    campaign.save!
    campaign
  end

  def create_budget(campaign)
    create(:ad_budget, campaign: campaign, daily_budget_cents: 1000)
  end

  def create_geo_targets(campaign)
    create(:ad_location_target, campaign: campaign,
      location_name: "Los Angeles",
      country_code: "US",
      location_type: "City",
      platform_settings: { "google" => { "criterion_id" => "geoTargetConstants/1013962" } })
    create(:ad_location_target, campaign: campaign,
      location_name: "New York",
      country_code: "US",
      location_type: "City",
      platform_settings: { "google" => { "criterion_id" => "geoTargetConstants/1023191" } })
  end

  def create_ad_schedules(campaign)
    %w[Monday Tuesday Wednesday Thursday Friday].each do |day|
      create(:ad_schedule, campaign: campaign, day_of_week: day, start_hour: 9, start_minute: 0, end_hour: 17, end_minute: 0)
    end
  end

  def create_assets(campaign, ad_group)
    5.times { |i| create(:ad_callout, campaign: campaign, ad_group: ad_group, text: "Callout #{i + 1}") }
    create(:ad_structured_snippet, campaign: campaign, category: StructuredSnippetCategoriesConfig.categories.first, values: ["Type A", "Type B", "Type C", "Type D"])
  end

  def create_keywords(ad_group)
    keywords = ["test product", "buy test", "best test product", "test solution", "affordable test"]
    keywords.each { |kw| create(:ad_keyword, ad_group: ad_group, text: kw, match_type: "broad") }
  end

  def create_ad_content(ad_group)
    ad = ad_group.ads.first
    15.times { |i| create(:ad_headline, ad: ad, text: "Headline #{i + 1}") }
    4.times { |i| create(:ad_description, ad: ad, text: "Description #{i + 1} for your ad campaign") }
  end

  def print_summary(account, project, website, website_url, upload, campaign)
    puts "Created complete campaign with all Google Ads requirements"
    puts "  - Account: #{account.name} (ID: #{account.id})"
    puts "  - Project: #{project.name} (ID: #{project.id})"
    puts "  - Website: #{website.id}"
    puts "  - Website URL: #{website_url.domain_string}#{website_url.path} (ID: #{website_url.id})"
    puts "  - Favicon (logo): Upload ID #{upload.id}"
    puts "  - Campaign: #{campaign.name} (ID: #{campaign.id})"
    puts "  - Budget: #{campaign.budget.daily_budget_cents} cents/day"
    puts "  - Geo Targets: #{campaign.location_targets.count}"
    puts "  - Ad Schedules: #{campaign.ad_schedules.count}"
    puts "  - Ad Groups: #{campaign.ad_groups.count}"
    ad_group = campaign.ad_groups.first
    puts "  - Keywords: #{ad_group.keywords.count}"
    puts "  - Callouts: #{ad_group.callouts.count}"
    puts "  - Structured Snippet: #{campaign.structured_snippet.category} (#{campaign.structured_snippet.values.count} values)"
    ad = ad_group.ads.first
    puts "  - Headlines: #{ad.headlines.count}"
    puts "  - Descriptions: #{ad.descriptions.count}"
  end
end
