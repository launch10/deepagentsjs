module GoogleAds
  # Batch scheduler that polls Google Ads invite status for active deploys
  #
  # Runs every 30 seconds. For each deploy where:
  # - User was active in the last 5 minutes (staring at the page)
  # - Deploy is still running
  # - There's a running GoogleAdsInvite job
  #
  # We enqueue a PollInviteAcceptanceWorker to check if the invite was accepted.
  class PollActiveInvitesWorker
    include Sidekiq::Worker

    sidekiq_options queue: :default, retry: 0

    def perform
      active_deploys_with_pending_invites.find_each do |deploy|
        job_run = deploy.job_runs.running.find_by(job_class: "GoogleAdsInvite")
        next unless job_run

        PollInviteAcceptanceWorker.perform_async(job_run.id)
      end
    end

    private

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
