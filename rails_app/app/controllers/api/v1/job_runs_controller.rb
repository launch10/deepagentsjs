class API::V1::JobRunsController < API::BaseController
  # Explicit whitelist of allowed job classes - never use constantize on user input
  JOB_CLASS_MAP = {
    'CampaignDeployWorker' => CampaignDeployWorker
  }.freeze

  def create
    job_class = JOB_CLASS_MAP[params[:job_class]]

    unless job_class
      return render json: { errors: ['Invalid job class'] }, status: :unprocessable_entity
    end

    job_run = current_account.job_runs.create!(
      job_class: params[:job_class],
      job_args: permitted_job_args,
      langgraph_thread_id: params[:thread_id],
      langgraph_callback_url: params[:callback_url]
    )

    job_class.perform_async(job_run.id)

    render json: { id: job_run.id, status: job_run.status }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  private

  def permitted_job_args
    # Convert to hash and merge account_id for downstream authorization
    args = params[:arguments]&.to_unsafe_h || {}
    args.merge(account_id: current_account.id)
  end
end
