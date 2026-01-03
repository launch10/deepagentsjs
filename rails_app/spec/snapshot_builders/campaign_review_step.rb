class CampaignReviewStep < BaseBuilder
  def base_snapshot
    "campaign_launch_step"
  end

  def output_name
    "campaign_review_step"
  end

  def build
    account = Account.first
    raise "Account not found" unless account

    project = account.projects.first
    raise "No project found for account #{account.id}" unless project

    website = project.website
    raise "No website found for project #{project.id}" unless website

    campaign = website.campaigns.first
    raise "No campaign found for website #{website.id}" unless campaign

    # Set launch settings (required for done_launch_stage?)
    campaign.google_advertising_channel_type = "SEARCH"
    campaign.google_bidding_strategy = :MAXIMIZE_CLICKS
    campaign.start_date = Date.tomorrow

    # Apply default network settings for SEARCH campaigns
    campaign.apply_default_network_settings_for_channel_type

    campaign.save!
    campaign.advance_stage!

    puts "Advanced campaign to review stage"
    puts "  - Campaign: #{campaign.name} (ID: #{campaign.id})"
    puts "  - Stage: #{campaign.stage}"
    puts "  - Channel type: #{campaign.google_advertising_channel_type}"
    puts "  - Bidding strategy: #{campaign.google_bidding_strategy}"
    puts "  - Start date: #{campaign.start_date}"

    campaign
  end
end
