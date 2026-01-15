module GoogleAds
  class SendInviteWorker
    include Sidekiq::Worker

    sidekiq_options queue: :default, retry: 3

    def perform(job_run_id)
      job_run = JobRun.find(job_run_id)
      job_run.start!

      account = job_run.account
      ads_account = account.ads_account || account.create_ads_account!(platform: "google")

      ads_account.google_sync unless ads_account.google_synced?
      ads_account.send_google_ads_invitation_email

      PollInviteAcceptanceWorker.perform_in(30.seconds, job_run_id, attempts: 0)
    rescue => e
      job_run.fail!(e)
      job_run.notify_langgraph(status: "failed", error: e.message)
    end
  end
end
