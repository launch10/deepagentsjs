module JobRunTrackable
  extend ActiveSupport::Concern

  private

  def with_job_run_tracking(job_run_id)
    @job_run = JobRun.find_by(id: job_run_id)

    unless @job_run
      Rails.logger.error("[#{self.class.name}] JobRun #{job_run_id} not found - this should not happen")
      return
    end

    return if @job_run.finished?
    return unless claim_job_run!

    yield
  rescue StandardError => e
    handle_job_failure(e)
    raise # Re-raise so Sidekiq can retry if configured
  end

  def claim_job_run!
    rows_updated = JobRun.where(id: @job_run.id, status: 'pending')
                         .update_all(status: 'running', started_at: Time.current)

    if rows_updated == 0
      Rails.logger.info("[#{self.class.name}] JobRun #{@job_run.id} already claimed by another worker, skipping")
      return false
    end

    @job_run.reload
    true
  end

  def complete_job_run!(result)
    @job_run.complete!(result)
    @job_run.notify_langgraph(status: 'completed', result: result)
  end

  def handle_job_failure(error)
    Rails.logger.error("[#{self.class.name}] JobRun #{@job_run&.id} failed: #{error.message}")
    Rails.logger.error(error.backtrace.first(10).join("\n"))
    @job_run&.fail!(error)
    @job_run&.notify_langgraph(status: 'failed', error: error.message)
  end
end
