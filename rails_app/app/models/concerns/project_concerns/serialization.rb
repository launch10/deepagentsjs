module ProjectConcerns
  module Serialization
    extend ActiveSupport::Concern

    def to_mini_json
      {
        id: id,
        uuid: uuid,
        website_id: website&.id,
        account_id: account_id,
        name: name,
        status: derived_status,
        domain: website&.domain,
        created_at: created_at,
        updated_at: updated_at
      }
    end

    # TODO: Add a `status` column to the projects table so this can be read
    # directly instead of derived from deploys/campaigns associations.
    def derived_status
      if deploys.loaded? ? deploys.any?(&:is_live) : deploys.live.exists?
        "live"
      elsif campaigns.loaded? ? campaigns.any? { |c| c.status == "paused" } : campaigns.where(status: "paused").exists?
        "paused"
      else
        "draft"
      end
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
        thread_id: project.current_chat&.thread_id,
        project: project.as_json,
        chat: project.current_chat&.as_json,
        workflow: project.current_workflow.as_json
      }
    end

    def to_brainstorm_json
      project = self

      {
        brainstorm: project.brainstorm.as_json,
        website: project.website.as_json
      }.merge!(core_json)
    end

    def to_website_json
      project = self

      {
        website: project.website.as_json
      }.merge!(core_json)
    end

    def to_deploy_json(deploy)
      Project.with_launch_relations.find_by(id: id)

      to_ad_campaign_json.merge!({
        thread_id: deploy.thread_id,
        deploy: {
          id: deploy.id,
          status: deploy.status,
          current_step: deploy.current_step,
          langgraph_thread_id: deploy.thread_id
        }
      })
    end

    def to_ad_campaign_json
      project = Project.with_launch_relations.find_by(id: id)
      campaign = project.campaigns.first

      result = to_brainstorm_json.merge!({
        ads_account: project.ads_account.as_json,
        campaign: nil,
        ad_group: nil,
        ad: nil,
        headlines: nil,
        descriptions: nil,
        languages: nil,
        keywords: nil,
        location_targets: nil,
        callouts: nil,
        structured_snippet: nil,
        ad_schedule: nil
      })

      if campaign
        ad_group = campaign.ad_groups.first
        ad = ad_group.ads.first

        result.merge!({
          campaign: campaign.as_json.merge(daily_budget_cents: campaign.daily_budget_cents),
          ad_group: ad_group.as_json,
          ad: ad.as_json,
          headlines: campaign.headlines.as_json,
          descriptions: campaign.descriptions.as_json,
          languages: campaign.languages.as_json,
          keywords: campaign.keywords.as_json,
          location_targets: campaign.location_targets.as_json,
          callouts: campaign.callouts.as_json,
          structured_snippet: campaign.structured_snippet.as_json,
          ad_schedule: campaign.schedule.as_json
        })
      end

      result
    end
  end
end
