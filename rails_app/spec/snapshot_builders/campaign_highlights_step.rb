class CampaignHighlightsStep < BaseBuilder
  def base_snapshot
    "campaign_content_step"
  end

  def output_name
    "campaign_highlights_step"
  end

  def build
    account = Account.first
    unless account
      raise "Account not found"
    end

    project = account.projects.first
    unless project
      raise "No project found for account #{account.id}"
    end

    website = project.website
    raise "No website found for project #{project.id}" unless website

    campaign = website.campaigns.first
    raise "No campaign found for website #{website.id}" unless campaign

    campaign.update_idempotently!({
      headlines: [{text: "Headline 1"}, {text: "Headline 2"}, {text: "Headline 3"}],
      descriptions: [{text: "Description 1"}, {text: "Description 2"}, {text: "Description 3"}],
    })
    campaign.advance_stage!

    campaign
  end
end
