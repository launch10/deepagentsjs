module GoogleAds
  # Checks if a Google Ads invitation has been accepted
  #
  # This worker is enqueued by PollActiveInvitesWorker (batch scheduler)
  # every 30 seconds for deploys where the user is active and has a
  # running GoogleAdsInvite job. No self-enqueue logic needed.
  class PollInviteAcceptanceWorker
    include Sidekiq::Worker

    sidekiq_options queue: :default, retry: 0

    # Fail the job after 30 minutes of polling without acceptance
    TIMEOUT_DURATION = 30.minutes

    def perform(job_run_id)
      job_run = JobRun.find_by(id: job_run_id)
      return unless job_run&.running?

      # Check for timeout - if job has been running too long, fail it
      if job_run.started_at && job_run.started_at < TIMEOUT_DURATION.ago
        job_run.fail!("Google Ads invitation not accepted within #{TIMEOUT_DURATION.inspect}. Please try again.")
        job_run.notify_langgraph(status: "failed", error: "Invitation acceptance timed out")
        return
      end

      invitation = job_run.account.ads_account&.google_account_invitation
      invitation&.google_refresh_status

      return unless invitation&.accepted?

      job_run.complete!({ status: "accepted" })
      job_run.notify_langgraph(status: "completed", result: { status: "accepted" })
    end
  end
end
