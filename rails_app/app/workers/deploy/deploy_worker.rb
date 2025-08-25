class Deploy
  class DeployWorker
    include Sidekiq::Worker

    sidekiq_options queue: :critical, retry: 5, backtrace: true

    sidekiq_retries_exhausted do |msg, ex|
      deploy_id = msg['args'].first
      Rails.logger.error "Failed to deploy #{deploy_id} after #{msg['retry_count']} retries: #{ex.message}"
      
      # Mark the deploy as failed
      deploy = Deploy.find_by(id: deploy_id)
      if deploy && deploy.status != 'failed'
        deploy.update!(
          status: 'failed',
          stacktrace: "Sidekiq retries exhausted: #{ex.message}\n#{ex.backtrace&.join("\n")}"
        )
      end
    end

    def perform(deploy_id)
      deploy = Deploy.find(deploy_id)

      Rails.logger.info "Starting async deploy #{deploy_id} for website #{deploy.website_id}"
      
      result = deploy.actually_deploy
      
      if result
        Rails.logger.info "Successfully deployed #{deploy_id}"
      else
        Rails.logger.error "Failed to deploy #{deploy_id}"
        raise StandardError, "Deploy #{deploy_id} failed"
      end
      
      result
    rescue ActiveRecord::RecordNotFound => e
      Rails.logger.error "Deploy #{deploy_id} not found: #{e.message}"
      raise e
    rescue => e
      Rails.logger.error "Error deploying #{deploy_id}: #{e.message}"
      raise e
    end
  end
end