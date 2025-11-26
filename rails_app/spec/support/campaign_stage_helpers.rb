module CampaignStageHelpers
  def create_campaign(account, attrs = {})
    if attrs[:campaign]
      campaign = attrs[:campaign]
      ad_group = campaign.ad_groups.first
      ad = ad_group.ads.first
      return [campaign, ad_group, ad]
    end

    # Create website with project via Brainstorm if not provided
    if attrs[:website_id] && attrs[:project_id]
      website_id = attrs[:website_id]
      project_id = attrs[:project_id]
    else
      # Ensure a template exists
      template = Template.first || create(:template)

      # Use canonical way to create project/website/brainstorm
      brainstorm_data = Brainstorm.create_brainstorm!(account, {
        name: attrs[:name] || "Test Campaign",
        thread_id: attrs[:thread_id] || "thread_#{SecureRandom.hex(8)}"
      })

      # Update website with template
      website = brainstorm_data[:website]
      website.update!(template: template)

      website_id = website.id
      project_id = brainstorm_data[:project].id
    end

    created_records = Campaign.create_campaign!(account, {
      name: attrs[:name] || "Test Campaign",
      website_id: website_id,
      project_id: project_id
    })

    [created_records[:campaign], created_records[:ad_group], created_records[:ad]]
  end

  def finish_content_stage(account, attrs = {})
    campaign, ad_group, ad = create_campaign(account, attrs)
    create_list(:ad_headline, 3, ad: ad)
    create_list(:ad_description, 2, ad: ad)
    campaign.advance_stage!

    [campaign.reload, ad_group.reload, ad.reload]
  end

  def finish_highlights_stage(account, attrs = {})
    campaign, ad_group, ad = finish_content_stage(account, attrs)
    create_list(:ad_callout, 2, ad_group: ad_group, campaign: campaign)
    campaign.advance_stage!

    [campaign.reload, ad_group.reload, ad.reload]
  end

  def finish_keywords_stage(account, attrs = {})
    campaign, ad_group, ad = finish_highlights_stage(account, attrs)
    create_list(:ad_keyword, 5, ad_group: ad_group)
    campaign.advance_stage!

    [campaign.reload, ad_group.reload, ad.reload]
  end

  def finish_settings_stage(account, attrs = {})
    campaign, ad_group, ad = finish_keywords_stage(account, attrs)

    campaign.update(daily_budget_cents: 1000)
    campaign.update_ad_schedules(
      time_zone: "America/New_York",
      always_on: true
    )
    campaign.update_location_targets([
      {
        target_type: "geo_location",
        location_name: "United States",
        location_type: "COUNTRY",
        country_code: "US",
        geo_target_constant: "geoTargetConstants/2840",
        google_criterion_id: "2840",
        targeted: true,
        radius: 10,
        radius_units: "miles"
      }
    ])

    campaign.advance_stage!

    [campaign.reload, ad_group.reload, ad.reload]
  end

  def finish_launch_stage(account, attrs = {})
    campaign, ad_group, ad = finish_settings_stage(account, attrs)

    campaign.update!(
      google_advertising_channel_type: "SEARCH",
      google_bidding_strategy: "MAXIMIZE_CLICKS",
      start_date: Date.parse("2025-12-01"),
      end_date: Date.parse("2025-12-31")
    )
    campaign.advance_stage!

    [campaign.reload, ad_group.reload, ad.reload]
  end
end

RSpec.configure do |config|
  config.include CampaignStageHelpers
end
