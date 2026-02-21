module CampaignConcerns
  module Creation
    extend ActiveSupport::Concern

    class_methods do
      def create_campaign!(account, campaign_params)
        transaction do
          project = Project.find(campaign_params[:project_id])

          # Do not allow project to create multiple campaigns for now
          if project.campaigns.any?
            campaign = project.campaigns.first
            ad_group = campaign.ad_groups.first
            ad = ad_group.ads.first

            return {
              campaign: campaign,
              ad_group: ad_group,
              ad: ad,
              chat: campaign.chat
            }
          end

          website_id = campaign_params.key?(:website_id) ? campaign_params[:website_id] : Website.find_by(project_id: campaign_params[:project_id])&.id

          # ChatCreatable auto-creates the chat on campaign creation
          campaign = account.campaigns.create!(
            name: campaign_params[:name],
            project_id: campaign_params[:project_id],
            website_id: website_id,
            initial_thread_id: campaign_params[:thread_id]
          )

          ad_group = campaign.ad_groups.create!(
            name: "Default Ad Group"
          )

          ad = ad_group.ads.create!(status: "draft")

          campaign.launch_workflow.update!(step: "ads", substep: "content")

          {
            campaign: campaign,
            ad_group: ad_group,
            ad: ad,
            chat: campaign.chat
          }
        end
      end
    end
  end
end
