class API::V1::JobRunsController < API::BaseController
  def create
    unless JobRun::ALLOWED_JOBS.include?(params[:job_class])
      return render json: { errors: ["Invalid job type"] }, status: :unprocessable_entity
    end

    # Validate resources exist before creating job_run
    resources = validate_resources(params[:job_class])

    job_run = current_account.job_runs.create!(
      job_class: params[:job_class],
      job_args: permitted_job_args,
      langgraph_thread_id: params[:thread_id],
      deploy_id: find_deploy_id
    )

    # Dispatch job after record is committed to avoid processing non-existent job_runs
    dispatch_job(params[:job_class], job_run, resources)

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
    when "WebsiteDeploy"
      website_id = params[:arguments]&.dig(:website_id) || params[:arguments]&.dig("website_id")
      { website: current_account.websites.find(website_id) }
    else
      {}
    end
  end

  def dispatch_job(job_type, job_run, resources)
    case job_type
    when "CampaignDeploy"
      CampaignDeploy.deploy(resources[:campaign], job_run_id: job_run.id)
    when "WebsiteDeploy"
      resources[:website].deploy_async(job_run_id: job_run.id)
    when "GoogleOAuthConnect"
      # No worker dispatch - OAuth callback completes this job
    when "GoogleAdsInvite"
      GoogleAds::SendInviteWorker.perform_async(job_run.id)
    end
  end

  def find_deploy_id
    return nil unless params[:deploy_id].present?

    # Validate deploy belongs to current account
    deploy = Deploy.joins(:project).find_by(
      id: params[:deploy_id],
      projects: { account_id: current_account.id }
    )
    deploy&.id
  end

  def permitted_job_args
    args = case params[:job_class]
    when "CampaignDeploy"
      params.require(:arguments).permit(:campaign_id)
    when "WebsiteDeploy"
      params.require(:arguments).permit(:website_id)
    when "GoogleOAuthConnect", "GoogleAdsInvite"
      # These jobs don't require arguments - account context comes from current_account
      ActionController::Parameters.new({}).permit
    else
      ActionController::Parameters.new({}).permit
    end.to_h

    args.merge(account_id: current_account.id)
  end
end
