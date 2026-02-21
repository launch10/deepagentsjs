module GoogleAds
  # Enables a Google Ads campaign for serving
  #
  # This worker is fired by enableCampaignNode in Langgraph.
  # It sets the campaign status to ENABLED and syncs with Google Ads.
  # Payment verification is assumed to have been done by checkPaymentNode.
  class CampaignEnableWorker
    include Sidekiq::Worker
    include ::DeployJobHandler

    sidekiq_options queue: :default, retry: 3

    def perform(job_run_id)
      job_run = JobRun.find(job_run_id)
      job_run.start!

      campaign_id = job_run.job_args["campaign_id"]
      raise ArgumentError, "campaign_id is required in job_args" unless campaign_id.present?
      campaign = job_run.account.campaigns.find(campaign_id)

      # Skip if already enabled
      if campaign.enabled?
        complete_with_status(job_run, enabled: true, campaign_id: campaign.id, already_enabled: true)
        return
      end

      # Update local statuses
      campaign.enable!

      # Sync just the status changes to Google (not a full CampaignDeploy re-sync)
      GoogleAds::Resources::Campaign.new(campaign).sync
      campaign.ad_groups.without_deleted.each do |ag|
        GoogleAds::Resources::AdGroup.new(ag).sync
      end
      campaign.ads.without_deleted.each do |ad|
        GoogleAds::Resources::Ad.new(ad).sync
      end

      complete_with_status(job_run, enabled: true, campaign_id: campaign.id)
    rescue => e
      handle_deploy_error(job_run, e)
    end

    private

    def complete_with_status(job_run, **result)
      job_run.complete!(result)
      job_run.notify_langgraph(status: "completed", result: result)
    end
  end
end
