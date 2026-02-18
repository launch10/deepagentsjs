module Monitoring
  class StuckDeployDetectorWorker < ApplicationWorker
    sidekiq_options queue: :default, retry: 0

    STUCK_ERROR = "Deploy stuck: no progress for over 15 minutes"

    def perform
      Deploy.stuck.find_each do |deploy|
        response = Rollbar.error("Stuck deploy detected", {
          deploy_id: deploy.id,
          project_id: deploy.project_id,
          status: deploy.status,
          created_at: deploy.created_at
        })
        rollbar_uuid = response.is_a?(Hash) && response["uuid"]

        deploy.update!(
          status: "failed",
          stacktrace: STUCK_ERROR,
          needs_support: false
        )

        Deploys::AutoSupportTicketService.new(deploy, rollbar_uuid: rollbar_uuid || nil).call
      rescue => e
        Rollbar.error("Failed to handle stuck deploy", {
          deploy_id: deploy.id,
          error: e.message
        })
      end
    end
  end
end
