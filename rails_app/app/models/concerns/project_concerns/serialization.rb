module ProjectConcerns
  module Serialization
    extend ActiveSupport::Concern

    def to_mini_json
      {
        id: id,
        website_id: website&.id,
        account_id: account_id,
        name: name,
        created_at: created_at,
        updated_at: updated_at
      }
    end

    def serialize
      case current_workflow.step.to_s
      when "brainstorm"
        to_brainstorm_json
      when "website"
        to_website_json
      when "ad_campaign"
        to_ad_campaign_json
      else
        to_mini_json
      end
    end

    def core_json
      project = self

      {
        thread_id: project.current_chat.thread_id,
        project: project.as_json,
        chat: project.current_chat.as_json,
        workflow: project.current_workflow.as_json,
      }
    end

    def to_brainstorm_json
      project = self

      {
        brainstorm: project.brainstorm.as_json,
        website: project.website.as_json,
      }.merge!(core_json)
    end

    def to_website_json
      # TODO: implement
    end

    def to_ad_campaign_json
      project = Project.with_launch_relations.find_by(id: id)
      campaign = project.campaigns.first

      if campaign
        ad_group = campaign.ad_groups.first
        ad = ad_group.ads.first
        headlines = campaign.headlines
        descriptions = campaign.descriptions
        languages = campaign.languages
        keywords = campaign.keywords
        location_targets = campaign.location_targets
        callouts = campaign.callouts
        structured_snippet = campaign.structured_snippet
        schedule = campaign.schedule
      end

      to_brainstorm_json.merge!({
        ads_account: project.ads_account.as_json,
        ad_group: ad_group.as_json,
        ad: ad.as_json,
        headlines: headlines.as_json,
        descriptions: descriptions.as_json,
        languages: languages.as_json,
        keywords: keywords.as_json,
        location_targets: location_targets.as_json,
        callouts: callouts.as_json,
        structured_snippet: structured_snippet.as_json,
        ad_schedule: schedule.as_json
      })
    end
  end
end
