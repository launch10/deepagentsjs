# Ensures the campaign has all required fields for deploy validation.
#
# Usage: await appScenario('fix_campaign_for_deploy')
#
# The campaign_launch_step snapshot may have incomplete platform_settings.
# This fills in any missing fields so deploy_validation_errors returns [].

campaign = Campaign.first
raise "No campaigns found" unless campaign

# Ensure required platform settings
campaign.google_bidding_strategy ||= "MAXIMIZE_CLICKS"
campaign.google_advertising_channel_type ||= "SEARCH"

# Ensure required dates
campaign.start_date ||= 1.day.from_now.to_date
campaign.time_zone ||= "America/New_York"

# Ensure budget exists (uses the daily_budget_cents= setter which builds AdBudget)
campaign.daily_budget_cents = 1000 unless campaign.daily_budget_cents&.positive?

campaign.save!

logger.info "[fix_campaign_for_deploy] Campaign #{campaign.id} updated for deploy readiness"

{ status: "ok", campaign_id: campaign.id, errors: campaign.deploy_validation_errors }
