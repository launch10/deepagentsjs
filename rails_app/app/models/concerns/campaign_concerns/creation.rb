module CampaignConcerns
  module Creation
    extend ActiveSupport::Concern

    class_methods do
      def create_campaign!(account, campaign_params)
        transaction do
          campaign = account.campaigns.create!(
            name: campaign_params[:name],
            project_id: campaign_params[:project_id],
            website_id: campaign_params[:website_id],
          )

          ad_group = campaign.ad_groups.create!(
            name: "Default Ad Group"
          )

          ad = ad_group.ads.create!(status: "draft")

          {
            campaign: campaign,
            ad_group: ad_group,
            ad: ad
          }
        end
      end
    end
  end
end
