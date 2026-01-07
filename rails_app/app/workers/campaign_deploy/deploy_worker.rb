class CampaignDeploy
  class DeployWorker
    include Sidekiq::Worker

    sidekiq_options queue: :critical, retry: 5, backtrace: true

    sidekiq_retries_exhausted do |msg, ex|
      deploy_id, job_run_id = msg["args"]
      Rails.logger.error "Failed to deploy campaign #{deploy_id} after #{msg["retry_count"]} retries: #{ex.message}"

      deploy = CampaignDeploy.find_by(id: deploy_id)
      if deploy && deploy.status != "failed"
        deploy.update!(
          status: "failed",
          stacktrace: "Sidekiq retries exhausted: #{ex.message}\n#{ex.backtrace&.first(10)&.join("\n")}"
        )
      end

      # Notify Langgraph of failure
      if job_run_id
        job_run = JobRun.find_by(id: job_run_id)
        if job_run && !job_run.finished?
          job_run.fail!(ex.message)
          job_run.notify_langgraph(status: "failed", error: ex.message)
        end
      end
    end

    def perform(deploy_id, job_run_id = nil)
      deploy = CampaignDeploy.find(deploy_id)
      job_run = job_run_id ? JobRun.find_by(id: job_run_id) : nil

      # Mark job_run as running on first iteration
      if job_run&.pending?
        job_run.update!(status: "running", started_at: Time.current)
      end

      Rails.logger.info "Running async campaign deploy #{deploy_id}, step: #{deploy.current_step || 'start'}"

      # Run one step - actually_deploy handles locking and step execution
      completed = deploy.actually_deploy(async: true, job_run_id: job_run_id)

      if completed && job_run && !job_run.finished?
        result = {
          campaign_id: deploy.campaign_id,
          campaign_deploy_id: deploy.id,
          status: "completed"
        }
        job_run.complete!(result)
        job_run.notify_langgraph(status: "completed", result: result)
      end
      # If not completed, actually_deploy already enqueued the next iteration
    rescue => e
      # Notify Langgraph immediately on failure (don't wait for retries to exhaust)
      if job_run && !job_run.finished?
        job_run.fail!(e.message)
        job_run.notify_langgraph(status: "failed", error: e.message)
      end
      raise # Re-raise so Sidekiq can retry
    end
  end
end
