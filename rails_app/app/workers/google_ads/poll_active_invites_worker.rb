module GoogleAds
  # Batch scheduler that polls Google Ads invite status for active deploys
  #
  # Runs every 30 seconds. Handles two responsibilities:
  #
  # 1. POLL ACTIVE INVITES: For deploys where user is active, poll for acceptance
  # 2. CLEANUP STALE JOBS: Fail any deploy jobs that have been running too long
  #
  class PollActiveInvitesWorker
    include Sidekiq::Worker

    sidekiq_options queue: :default, retry: 0

    # Jobs running longer than this are considered stale and will be failed
    TIMEOUT_DURATION = 30.minutes

    def perform
      # First: fail any stale jobs (cleanup)
      fail_stale_jobs

      # Then: poll active invites
      poll_active_invites
    end

    private

    def poll_active_invites
      deploys = active_deploys_with_pending_invites.to_a
      Rails.logger.info "[VerifyGoogle::PollActiveInvites] #{Time.current.iso8601(3)} found #{deploys.size} active deploys with pending invites"

      deploys.each do |deploy|
        job_run = deploy.job_runs.running.find_by(job_class: "GoogleAdsInvite")
        unless job_run
          Rails.logger.info "[VerifyGoogle::PollActiveInvites] #{Time.current.iso8601(3)} deploy=#{deploy.id} — no running GoogleAdsInvite job_run, skipping"
          next
        end

        Rails.logger.info "[VerifyGoogle::PollActiveInvites] #{Time.current.iso8601(3)} deploy=#{deploy.id} job_run=#{job_run.id} user_active_at=#{deploy.user_active_at&.iso8601(3)} deploy_status=#{deploy.status} — enqueuing PollInviteAcceptanceWorker"
        GoogleAds::PollInviteAcceptanceWorker.perform_async(job_run.id)
      end
    end

    def fail_stale_jobs
      # Find all deploy-related jobs that have been running too long
      stale_jobs = JobRun
        .running
        .where(job_class: %w[GoogleAdsInvite])
        .where(started_at: ...TIMEOUT_DURATION.ago)

      stale_jobs.find_each do |job_run|
        Rails.logger.info "[PollActiveInvitesWorker] Failing stale job: #{job_run.job_class} ##{job_run.id} (started #{job_run.started_at})"

        job_run.fail!("Job timed out after #{TIMEOUT_DURATION.inspect}. Please try again.")
        job_run.notify_langgraph(status: "failed", error: "Job timed out")
      end
    end

    def active_deploys_with_pending_invites
      Deploy
        .in_progress
        .user_recently_active
        .joins(:job_runs)
        .where(job_runs: { status: "running", job_class: "GoogleAdsInvite" })
        .distinct
    end
  end
end
