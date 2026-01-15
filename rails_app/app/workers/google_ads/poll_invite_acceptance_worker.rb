module GoogleAds
  class PollInviteAcceptanceWorker
    include Sidekiq::Worker

    sidekiq_options queue: :default, retry: 0

    MAX_ATTEMPTS = 10  # 5 minutes total (30 seconds * 10)

    def perform(job_run_id, options = {})
      job_run = JobRun.find_by(id: job_run_id)
      return unless job_run&.running?

      attempts = options["attempts"] || 0
      invitation = job_run.account.ads_account&.google_account_invitation
      invitation&.google_refresh_status

      if invitation&.accepted?
        job_run.complete!({ status: "accepted" })
        job_run.notify_langgraph(status: "completed", result: { status: "accepted" })
      elsif attempts >= MAX_ATTEMPTS
        # Timeout - don't fail, user can re-trigger via frontend
      else
        self.class.perform_in(30.seconds, job_run_id, attempts: attempts + 1)
      end
    end
  end
end
