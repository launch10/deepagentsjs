class CampaignSettingsStep < BaseBuilder
  def base_snapshot
    "campaign_keywords_step"
  end

  def output_name
    "campaign_settings_step"
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

    # Fill keywords for each ad group (need 5-15 per group)
    keywords = [
      "marketing automation software",
      "email marketing tools",
      "crm for small business",
      "lead generation platform",
      "customer engagement software",
      "sales automation tools",
      "marketing analytics platform"
    ]

    campaign.ad_groups.each do |ad_group|
      keywords.each_with_index do |keyword_text, index|
        ad_group.keywords.find_or_create_by!(text: keyword_text) do |kw|
          kw.position = index
          kw.match_type = "broad"
        end
      end
    end

    campaign.advance_stage!

    puts "Advanced campaign to settings stage"
    puts "  - Campaign: #{campaign.name} (ID: #{campaign.id})"
    puts "  - Stage: #{campaign.stage}"
    puts "  - Keywords per ad group: #{campaign.ad_groups.first&.keywords&.count}"

    campaign
  end
end
