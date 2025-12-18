class CampaignDeploy
  class DeployWorker
    include Sidekiq::Worker

    sidekiq_options queue: :critical, retry: 5, backtrace: true

    sidekiq_retries_exhausted do |msg, ex|
      deploy_id = msg["args"].first
      Rails.logger.error "Failed to deploy campaign #{deploy_id} after #{msg["retry_count"]} retries: #{ex.message}"

      deploy = CampaignDeploy.find_by(id: deploy_id)
      if deploy && deploy.status != "failed"
        deploy.update!(
          status: "failed",
          stacktrace: "Sidekiq retries exhausted: #{ex.message}\n#{ex.backtrace&.join("\n")}"
        )
      end
    end

    def perform(deploy_id)
      deploy = CampaignDeploy.find(deploy_id)
      Rails.logger.info "Starting async campaign deploy #{deploy_id}"
      deploy.actually_deploy
    end
  end
end
