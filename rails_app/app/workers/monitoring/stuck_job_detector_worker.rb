module Monitoring
  class StuckJobDetectorWorker < ApplicationWorker
    sidekiq_options queue: :default, retry: 0

    STUCK_ERROR = "Job run stuck: no progress for over 10 minutes"

    def perform
      JobRun.stuck.find_each do |job_run|
        Rollbar.error("Stuck job run detected", {
          job_run_id: job_run.id,
          job_class: job_run.job_class,
          status: job_run.status,
          created_at: job_run.created_at,
          deploy_id: job_run.deploy_id
        })

        job_run.fail!(STUCK_ERROR)
        job_run.notify_langgraph(status: "failed", error: STUCK_ERROR)

        # Create support ticket directly — Langgraph may be down
        create_support_ticket(job_run)
      end
    end

    private

    def create_support_ticket(job_run)
      deploy = job_run.deploy
      return unless deploy.present?

      Deploys::AutoSupportTicketService.new(deploy).call
    rescue => e
      Rollbar.error("Failed to create support ticket for stuck job", {
        job_run_id: job_run.id,
        deploy_id: job_run.deploy_id,
        error: e.message
      })
    end
  end
end
