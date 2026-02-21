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
      Rails.logger.info "[VerifyGoogle::PollInviteAcceptance] #{Time.current.iso8601(3)} job_run_id=#{job_run_id} found=#{job_run.present?} status=#{job_run&.status}"
      return unless job_run&.running?

      # Check for timeout - if job has been running too long, fail it
      if job_run.started_at && job_run.started_at < TIMEOUT_DURATION.ago
        Rails.logger.info "[VerifyGoogle::PollInviteAcceptance] #{Time.current.iso8601(3)} job_run=#{job_run.id} TIMEOUT — started_at=#{job_run.started_at.iso8601(3)}"
        job_run.fail!("Google Ads invitation not accepted within #{TIMEOUT_DURATION.inspect}. Please try again.")
        job_run.notify_langgraph(status: "failed", error: "Invitation acceptance timed out")
        return
      end

      invitation = job_run.account.ads_account&.google_account_invitation
      status_before = invitation&.google_status
      Rails.logger.info "[VerifyGoogle::PollInviteAcceptance] #{Time.current.iso8601(3)} job_run=#{job_run.id} account=#{job_run.account_id} invitation=#{invitation&.id} status_before=#{status_before}"

      invitation&.google_refresh_status

      invitation&.reload
      status_after = invitation&.google_status
      Rails.logger.info "[VerifyGoogle::PollInviteAcceptance] #{Time.current.iso8601(3)} job_run=#{job_run.id} status_after=#{status_after} accepted=#{invitation&.accepted?} changed=#{status_before != status_after}"

      return unless invitation&.accepted?

      Rails.logger.info "[VerifyGoogle::PollInviteAcceptance] #{Time.current.iso8601(3)} job_run=#{job_run.id} COMPLETING — invite accepted! Notifying langgraph thread=#{job_run.langgraph_thread_id}"
      job_run.complete!({ status: "accepted" })
      job_run.notify_langgraph(status: "completed", result: { status: "accepted" })
    end
  end
end
