module SnapshotBuilder
  module Ads
  end
end

class SnapshotBuilder::Ads::Mocker
  def self.build(account: nil, project: nil, website: nil)
    new(account: account, project: project, website: website)
  end

  attr_accessor :account, :project, :website, :campaign
  def initialize(account: nil, project: nil, website: nil)
    @account = account
    @project = project
    @website = website
  end

  def mock
    create_campaign
    finish_content_step
    finish_highlights_step
    finish_keywords_step
    finish_settings_step
    finish_review_step
    self
  end

  def create_campaign
    project.workflows.find_or_create_by!(
      workflow_type: "launch"
    )
    objects = Campaign.create_campaign!(account, {
      name: "Test Campaign",
      project_id: project.id,
      website_id: website.id
    })
    @campaign = objects[:campaign]
    self
  end

  def finish_content_step
    campaign.update_idempotently!({
      headlines: [{text: "Headline 1"}, {text: "Headline 2"}, {text: "Headline 3"}],
      descriptions: [{text: "Description 1"}, {text: "Description 2"}, {text: "Description 3"}]
    })
    campaign.advance_stage!
    self
  end

  def finish_highlights_step
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
    self
  end

  def finish_keywords_step
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
    self
  end

  def finish_settings_step
    # Set launch settings (required for done_launch_stage?)
    campaign.google_advertising_channel_type = "SEARCH"
    campaign.google_bidding_strategy = :MAXIMIZE_CLICKS
    campaign.start_date = Date.tomorrow

    # Apply default network settings for SEARCH campaigns
    campaign.apply_default_network_settings_for_channel_type

    # Set location targeting (United States)
    campaign.update_location_targets([
      {
        target_type: "geo_location",
        location_name: "United States",
        location_type: "Country",
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

    campaign.save!
    campaign.advance_stage!
    self
  end

  def finish_review_step
    campaign.advance_stage!
    self
  end
end
