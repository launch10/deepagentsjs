class WebsiteDeploy
  class DeployWorker
    include Sidekiq::Worker

    sidekiq_options queue: :critical, retry: 5, backtrace: true

    sidekiq_retries_exhausted do |msg, ex|
      deploy_id, job_run_id = msg["args"]
      Rails.logger.error "Failed to deploy #{deploy_id} after #{msg["retry_count"]} retries: #{ex.message}"

      deploy = WebsiteDeploy.find_by(id: deploy_id)
      if deploy && deploy.status != "failed"
        deploy.update!(
          status: "failed",
          stacktrace: "Sidekiq retries exhausted: #{ex.message}\n#{ex.backtrace&.first(10)&.join("\n")}"
        )
      end

      if job_run_id
        job_run = JobRun.find_by(id: job_run_id)
        if job_run && !job_run.finished?
          job_run.fail!(ex.message)
          job_run.notify_langgraph(status: "failed", error: ex.message)
        end
      end
    end

    def perform(deploy_id, job_run_id = nil)
      deploy = WebsiteDeploy.find(deploy_id)
      job_run = job_run_id ? JobRun.find_by(id: job_run_id) : nil

      # Guard: deploy was superseded -- exit without retry
      if deploy.status.in?(%w[skipped failed completed])
        Rails.logger.info "Deploy #{deploy_id} already #{deploy.status}, skipping worker"
        return true
      end

      # Guard: job_run was superseded -- exit without retry
      if job_run&.finished?
        Rails.logger.info "JobRun #{job_run_id} already #{job_run.status}, skipping worker"
        return true
      end

      if job_run&.pending?
        job_run.update!(status: "running", started_at: Time.current)
      end

      Rails.logger.info "Starting deploy #{deploy_id} for website #{deploy.website_id} (job_run: #{job_run_id || "none"})"

      result = deploy.actually_deploy

      if result
        Rails.logger.info "Successfully deployed #{deploy_id}"
        if job_run && !job_run.finished?
          deploy_result = { website_id: deploy.website_id, deploy_id: deploy.id, status: "completed" }
          job_run.complete!(deploy_result)
          job_run.notify_langgraph(status: "completed", result: deploy_result)
        end
      else
        Rails.logger.error "Failed to deploy #{deploy_id}"
        if job_run && !job_run.finished?
          job_run.fail!("Website deploy #{deploy_id} failed")
          job_run.notify_langgraph(status: "failed", error: "Website deploy failed")
        end
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
