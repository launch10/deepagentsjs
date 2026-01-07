class API::V1::JobRunsController < API::BaseController
  def create
    unless JobRun::ALLOWED_JOBS.include?(params[:job_class])
      return render json: { errors: ["Invalid job type"] }, status: :unprocessable_entity
    end

    # Validate resources exist before creating job_run
    resources = validate_resources(params[:job_class])

    job_run = ActiveRecord::Base.transaction do
      jr = current_account.job_runs.create!(
        job_class: params[:job_class],
        job_args: permitted_job_args,
        langgraph_thread_id: params[:thread_id],
        langgraph_callback_url: params[:callback_url]
      )
      dispatch_job(params[:job_class], jr, resources)
      jr
    end

    render json: { id: job_run.id, status: job_run.status }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotFound => e
    render json: { errors: [e.message] }, status: :not_found
  end

  private

  def validate_resources(job_type)
    case job_type
    when "CampaignDeploy"
      campaign_id = params[:arguments]&.dig(:campaign_id) || params[:arguments]&.dig("campaign_id")
      { campaign: current_account.campaigns.find(campaign_id) }
    else
      {}
    end
  end

  def dispatch_job(job_type, job_run, resources)
    case job_type
    when "CampaignDeploy"
      CampaignDeploy.deploy(resources[:campaign], job_run_id: job_run.id)
    end
  end

  def permitted_job_args
    # Convert to hash and merge account_id for downstream authorization
    args = params[:arguments]&.to_unsafe_h || {}
    args.merge(account_id: current_account.id)
  end
end
