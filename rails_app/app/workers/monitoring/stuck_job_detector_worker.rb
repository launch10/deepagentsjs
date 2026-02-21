module Monitoring
  class StuckJobDetectorWorker < ApplicationWorker
    sidekiq_options queue: :default, retry: 0

    STUCK_ERROR = "Job run stuck: no progress for over 10 minutes"

    def perform
      JobRun.stuck.find_each do |job_run|
        event = Sentry.capture_message("Stuck job run detected", extra: {
          job_run_id: job_run.id,
          job_class: job_run.job_class,
          status: job_run.status,
          created_at: job_run.created_at,
          deploy_id: job_run.deploy_id
        })
        sentry_event_id = event&.event_id

        job_run.fail!(STUCK_ERROR)
        job_run.notify_langgraph(status: "failed", error: STUCK_ERROR)

        # Create support ticket directly — Langgraph may be down
        create_support_ticket(job_run, sentry_event_id: sentry_event_id)
      end
    end

    private

    def create_support_ticket(job_run, sentry_event_id: nil)
      deploy = job_run.deploy
      return unless deploy.present?

      Deploys::AutoSupportTicketService.new(deploy, sentry_event_id: sentry_event_id).call
    rescue => e
      Sentry.capture_message("Failed to create support ticket for stuck job", extra: {
        job_run_id: job_run.id,
        deploy_id: job_run.deploy_id,
        error: e.message
      })
    end
  end
end
