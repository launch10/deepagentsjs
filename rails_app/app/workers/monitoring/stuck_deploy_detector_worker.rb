module Monitoring
  class StuckDeployDetectorWorker < ApplicationWorker
    sidekiq_options queue: :default, retry: 0

    STUCK_ERROR = "Deploy stuck: no progress for over 15 minutes"

    def perform
      Deploy.stuck.find_each do |deploy|
        event = Sentry.capture_message("Stuck deploy detected", extra: {
          deploy_id: deploy.id,
          project_id: deploy.project_id,
          status: deploy.status,
          created_at: deploy.created_at
        })
        sentry_event_id = event&.event_id

        deploy.update!(
          status: "failed",
          stacktrace: STUCK_ERROR,
          needs_support: false
        )

        Deploys::AutoSupportTicketService.new(deploy, sentry_event_id: sentry_event_id).call
      rescue => e
        Sentry.capture_message("Failed to handle stuck deploy", extra: {
          deploy_id: deploy.id,
          error: e.message
        })
      end
    end
  end
end
