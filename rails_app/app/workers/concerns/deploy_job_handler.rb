module DeployJobHandler
  extend ActiveSupport::Concern

  included do
    sidekiq_retries_exhausted do |msg, ex|
      # Backstop for process crashes (OOM, kill -9) where handle_deploy_error never ran.
      # In normal operation, handle_deploy_error reports the failure before this fires.
      job_run_id = msg["args"].first
      job_run = JobRun.find_by(id: job_run_id)
      next unless job_run && !job_run.finished?

      error_type = DeployJobs::ErrorClassifier.classify(ex)
      job_run.update_column(:error_type, error_type.to_s)
      job_run.fail!("Retries exhausted: #{ex.message}")
      job_run.notify_langgraph(status: "failed", error: ex.message)
    end
  end

  private

  # Classify the error and report it immediately.
  #
  # Philosophy: fail fast, fail loud. Every error is reported to Langgraph
  # immediately so the user sees the failure right away.
  # Sidekiq retries are kept as a backstop for process crashes only.
  def handle_deploy_error(job_run, error)
    return if job_run.finished?

    error_type = DeployJobs::ErrorClassifier.classify(error)

    Rails.logger.error(
      "[DeployJobHandler] #{job_run.job_class} job_run=#{job_run.id} " \
      "error_type=#{error_type} error=#{error.class}: #{error.message}"
    )

    job_run.update_column(:error_type, error_type.to_s)
    job_run.fail!(error)
    job_run.notify_langgraph(status: "failed", error: error.message)
    # Do not re-raise — Sidekiq considers the job done, no retry.
    # sidekiq_retries_exhausted serves as backstop for process crashes only.
  end
end
