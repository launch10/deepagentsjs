module GoogleAds
  # Enables a Google Ads campaign for serving
  #
  # This worker is fired by enableCampaignNode in Langgraph.
  # It sets the campaign status to ENABLED and syncs with Google Ads.
  # Payment verification is assumed to have been done by checkPaymentNode.
  class CampaignEnableWorker
    include Sidekiq::Worker

    sidekiq_options queue: :default, retry: 3

    def perform(job_run_id)
      job_run = JobRun.find(job_run_id)
      job_run.start!

      campaign_id = job_run.job_args["campaign_id"]
      campaign = job_run.account.campaigns.find(campaign_id)

      # Skip if already enabled
      if campaign.enabled?
        complete_with_status(job_run, enabled: true, campaign_id: campaign.id, already_enabled: true)
        return
      end

      # Enable the campaign and sync with Google
      campaign.enable!

      complete_with_status(job_run, enabled: true, campaign_id: campaign.id)
    rescue => e
      job_run.fail!(e)
      job_run.notify_langgraph(status: "failed", error: e.message)
    end

    private

    def complete_with_status(job_run, **result)
      job_run.complete!(result)
      job_run.notify_langgraph(status: "completed", result: result)
    end
  end
end
