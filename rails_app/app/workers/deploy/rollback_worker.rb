class Deploy
  class RollbackWorker
    include Sidekiq::Worker

    sidekiq_options queue: :critical, retry: 3, backtrace: true

    sidekiq_retry_in do |count, exception|
      case count
      when 0
        30 # 30 seconds - faster retries for critical rollbacks
      when 1
        120 # 2 minutes
      when 2
        600 # 10 minutes
      else
        :kill # Don't retry after 3 attempts
      end
    end

    sidekiq_retries_exhausted do |msg, ex|
      deploy_id = msg['args'].first
      Rails.logger.error "Failed to rollback deploy #{deploy_id} after #{msg['retry_count']} retries: #{ex.message}"
      
      # Alert on rollback failures since they're critical
      deploy = Deploy.find_by(id: deploy_id)
      if deploy
        Rails.logger.error "CRITICAL: Rollback failed for website #{deploy.website_id}, deploy #{deploy_id}"
        # FUTURE: trigger alerts/notifications here
      end
    end

    def perform(deploy_id)
      deploy = Deploy.find(deploy_id)
      
      Rails.logger.info "Starting async rollback for deploy #{deploy_id}, website #{deploy.website_id}"
      
      result = deploy.actually_rollback
      
      if result
        Rails.logger.info "Successfully rolled back deploy #{deploy_id}"
      else
        Rails.logger.error "Failed to rollback deploy #{deploy_id}"
        raise StandardError, "Rollback failed for deploy #{deploy_id}"
      end
      
      result
    rescue ActiveRecord::RecordNotFound => e
      Rails.logger.error "Deploy #{deploy_id} not found for rollback: #{e.message}"
      raise e
    rescue => e
      Rails.logger.error "Error rolling back deploy #{deploy_id}: #{e.message}"
      raise e
    end
  end
end