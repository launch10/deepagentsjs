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
            chat = campaign.chat

            return {
              campaign: campaign,
              ad_group: ad_group,
              ad: ad,
              chat: chat
            }
          end

          campaign = account.campaigns.create!(
            name: campaign_params[:name],
            project_id: campaign_params[:project_id],
            website_id: campaign_params[:website_id]
          )

          ad_group = campaign.ad_groups.create!(
            name: "Default Ad Group"
          )

          ad = ad_group.ads.create!(status: "draft")

          campaign.launch_workflow.update!(step: "ad_campaign", substep: "content")

          # Create chat for this campaign
          thread_id = UUID7.generate
          unless campaign.chat.present?
            chat = campaign.build_chat(
              name: "Ad Campaign Chat",
              chat_type: "ads",
              contextable: campaign,
              thread_id: thread_id,
              project: campaign.project,
              account: account
            )
            chat.save!
          end

          {
            campaign: campaign,
            ad_group: ad_group,
            ad: ad,
            chat: chat
          }
        end
      end
    end
  end
end
