class CampaignKeywordsStep < BaseBuilder
  def base_snapshot
    "campaign_highlights_step"
  end

  def output_name
    "campaign_keywords_step"
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

    # Fill highlights: callouts + structured snippets
    campaign.update_idempotently!({
      callouts: [
        {text: "Free Shipping"},
        {text: "24/7 Support"},
        {text: "Money Back Guarantee"},
        {text: "Expert Consultation"}
      ],
      structured_snippet: {
        category: "services",
        values: ["Premium Support", "Basic Plan", "Enterprise", "Custom Solutions"]
      }
    })

    campaign.advance_stage!

    puts "Advanced campaign to keywords stage"
    puts "  - Campaign: #{campaign.name} (ID: #{campaign.id})"
    puts "  - Stage: #{campaign.stage}"
    puts "  - Callouts: #{campaign.callouts.count}"

    campaign
  end
end
