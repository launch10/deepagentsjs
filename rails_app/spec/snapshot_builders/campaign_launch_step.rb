class CampaignLaunchStep < BaseBuilder
  def base_snapshot
    "campaign_settings_step"
  end

  def output_name
    "campaign_launch_step"
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

    # Set location targeting (United States)
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

    # Set schedule to always on
    campaign.ad_schedules.destroy_all
    campaign.ad_schedules.create!(always_on: true)

    # Set daily budget (25 dollars = 2500 cents)
    campaign.daily_budget_cents = 2500

    campaign.advance_stage!

    puts "Advanced campaign to launch stage"
    puts "  - Campaign: #{campaign.name} (ID: #{campaign.id})"
    puts "  - Stage: #{campaign.stage}"
    puts "  - Location targets: #{campaign.location_targets.count}"
    puts "  - Schedule: always_on=#{campaign.ad_schedules.first&.always_on}"
    puts "  - Daily budget: $#{campaign.daily_budget_cents.to_f / 100}"

    campaign
  end
end
