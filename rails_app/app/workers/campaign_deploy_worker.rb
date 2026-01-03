class CampaignDeployWorker
  include Sidekiq::Worker
  include JobRunTrackable

  sidekiq_options queue: :critical, retry: 5, backtrace: true

  def perform(job_run_id)
    with_job_run_tracking(job_run_id) do
      result = deploy_campaign
      complete_job_run!(result)
    end
  end

  private

  def deploy_campaign
    args = @job_run.job_args.symbolize_keys
    account = Account.find(args[:account_id])
    campaign = account.campaigns.find(args[:campaign_id])

    result = CampaignDeployService.call(campaign: campaign)

    {
      campaign_id: campaign.id,
      platform: result.platform,
      external_id: result.external_id,
      deployed_at: result.deployed_at.iso8601
    }
  end
end
