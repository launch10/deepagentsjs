class CampaignDeploy
  class DeployWorker
    include Sidekiq::Worker

    sidekiq_options queue: :critical, retry: 5, backtrace: true

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
    rescue CampaignDeploy::TerminalStepError => e
      Rails.logger.error "Terminal error deploying campaign #{deploy_id}: #{e.message}"
      fail_deploy!(deploy, job_run, e.message, e.backtrace)
      # Do not re-raise — Sidekiq considers the job done, no retry
    end

    private

    def self.fail_deploy!(deploy, job_run, error_message, backtrace = nil)
      if deploy && deploy.status != "failed"
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

      if job_run && !job_run.finished?
        job_run.fail!(error_message)
        job_run.notify_langgraph(status: "failed", error: error_message)
      end
    end

    # Instance method delegates to class method for use in rescue block
    def fail_deploy!(deploy, job_run, error_message, backtrace = nil)
      self.class.fail_deploy!(deploy, job_run, error_message, backtrace)
    end
  end
end
