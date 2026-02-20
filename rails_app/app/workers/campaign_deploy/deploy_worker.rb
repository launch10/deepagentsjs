class CampaignDeploy
  class DeployWorker
    include Sidekiq::Worker
    include ::DeployJobHandler

    sidekiq_options queue: :critical, retry: 5, backtrace: true

    # Override the default DeployJobHandler retries_exhausted to also update the deploy record
    sidekiq_retries_exhausted do |msg, ex|
      deploy_id, job_run_id = msg["args"]
      Rails.logger.error "Failed to deploy campaign #{deploy_id} after #{msg["retry_count"]} retries: #{ex.message}"

      deploy = CampaignDeploy.find_by(id: deploy_id)
      job_run = job_run_id ? JobRun.find_by(id: job_run_id) : nil

      fail_deploy!(deploy, job_run, ex.message, ex.backtrace)
    end

    def perform(deploy_id, job_run_id = nil)
      deploy = CampaignDeploy.find(deploy_id)
      job_run = job_run_id ? JobRun.find_by(id: job_run_id) : nil

      # Guard: don't retry on an already-failed deploy
      if deploy.status == "failed"
        Rails.logger.warn "Skipping retry for already-failed campaign deploy #{deploy_id}"
        return
      end

      # Mark job_run as running on first iteration
      if job_run&.pending?
        job_run.update!(status: "running", started_at: Time.current)
      end

      Rails.logger.info "Running async campaign deploy #{deploy_id}, step: #{deploy.current_step || "start"}"

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
    rescue => e
      Rails.logger.error "Error deploying campaign #{deploy_id}: #{e.message}"

      # Update the deploy record regardless of error type
      fail_deploy_record!(deploy, e.message, e.backtrace)

      # Route through handle_deploy_error for classification + immediate reporting
      if job_run
        handle_deploy_error(job_run, e)
      else
        raise e
      end
    end

    def self.fail_deploy!(deploy, job_run, error_message, backtrace = nil)
      fail_deploy_record!(deploy, error_message, backtrace)

      if job_run && !job_run.finished?
        job_run.fail!(error_message)
        job_run.notify_langgraph(status: "failed", error: error_message)
      end
    end

    def self.fail_deploy_record!(deploy, error_message, backtrace = nil)
      return unless deploy && deploy.status != "failed"

      deploy.update!(
        status: "failed",
        stacktrace: "#{error_message}\n#{backtrace&.first(10)&.join("\n")}"
      )

      account = deploy.campaign&.project&.account
      if account&.owner
        TrackEvent.call("campaign_deployed",
          user: account.owner,
          account: account,
          project: deploy.campaign.project,
          campaign: deploy.campaign,
          project_uuid: deploy.campaign.project.uuid,
          deploy_status: "failed",
          failed_step: deploy.current_step,
          daily_budget_cents: deploy.campaign.daily_budget_cents)
      end
    end

    # Instance method delegates to class method for use in rescue block
    def fail_deploy!(deploy, job_run, error_message, backtrace = nil)
      self.class.fail_deploy!(deploy, job_run, error_message, backtrace)
    end

    def fail_deploy_record!(deploy, error_message, backtrace = nil)
      self.class.fail_deploy_record!(deploy, error_message, backtrace)
    end
  end
end
