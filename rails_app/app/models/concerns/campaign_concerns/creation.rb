module CampaignConcerns
  module Creation
    extend ActiveSupport::Concern

    class_methods do
      def create_campaign!(account, campaign_params)
        transaction do
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
          chat = campaign.build_chat(
            name: "Ad Campaign Chat",
            chat_type: "ads",
            contextable: campaign,
            thread_id: thread_id,
            project: campaign.project,
            account: account
          )
          chat.save!

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
