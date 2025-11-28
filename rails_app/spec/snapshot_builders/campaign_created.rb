class CampaignCreated < BaseBuilder
  def base_snapshot
    "website_created"
  end

  def output_name
    "campaign_created"
  end

  def build
    account = Account.first
    unless account
      user = create(:user, name: "Test User")
      account = user.owned_account
    end

    project = account.projects.first
    unless project
      raise "No project found for account #{account.id}"
    end

    website = project.website
    raise "No website found for project #{project.id}" unless website

    result = Campaign.create_campaign!(account, {
      name: "Test Campaign",
      project_id: project.id,
      website_id: website.id
    })

    campaign = result[:campaign]
    puts "Created campaign: #{campaign.name} (ID: #{campaign.id})"
    puts "  - Account: #{account.name} (ID: #{account.id})"
    puts "  - Project: #{project.name} (ID: #{project.id})"
    puts "  - Ad groups: #{campaign.ad_groups.count}"
    puts "  - Ads: #{campaign.ad_groups.sum { |ag| ag.ads.count }}"

    campaign
  end
end
