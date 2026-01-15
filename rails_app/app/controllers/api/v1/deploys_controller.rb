class API::V1::DeploysController < API::BaseController
  # POST /api/v1/deploys
  # Creates a new deploy for a project
  def create
    project = current_account.projects.find(params[:project_id])
    deploy = project.deploys.create!(status: "pending")

    render json: deploy_json(deploy), status: :created
  end

  # GET /api/v1/deploys/:id
  # Returns deploy details
  def show
    deploy = find_deploy
    render json: deploy_json(deploy)
  end

  # PATCH /api/v1/deploys/:id
  # Updates deploy status, step, etc.
  def update
    deploy = find_deploy
    deploy.update!(deploy_params)

    render json: deploy_json(deploy)
  end

  private

  def find_deploy
    Deploy.joins(:project)
      .where(projects: { account_id: current_account.id })
      .find(params[:id])
  end

  def deploy_params
    params.permit(:status, :current_step, :is_live, :langgraph_thread_id, :stacktrace)
  end

  def deploy_json(deploy)
    {
      id: deploy.id,
      project_id: deploy.project_id,
      status: deploy.status,
      current_step: deploy.current_step,
      is_live: deploy.is_live,
      langgraph_thread_id: deploy.langgraph_thread_id,
      created_at: deploy.created_at,
      updated_at: deploy.updated_at
    }
  end
end
