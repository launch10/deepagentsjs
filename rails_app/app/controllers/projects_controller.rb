class ProjectsController < SubscribedController
  def index
    _, projects_records = pagy(current_user.projects.order(id: :desc))
    projects = projects_records.map(&:to_mini_json)

    respond_to do |format|
      format.html do
        render inertia: 'Home', props: {
          jwt: cookies[:jwt],
          projects: projects,
        }, layout: "layouts/webcontainer"
      end
      format.json do
        render json: {
          projects: projects,
        }
      end
    end
  end

  def show
    @project = current_account.projects.find_by(thread_id: params[:thread_id])
    redirect_to root_path and return unless @project

    render inertia: 'Home', props: {
      jwt: cookies[:jwt],
      thread_id: params[:thread_id],
      # files: project.files
    }, layout: "layouts/webcontainer"
  end

  def create
    begin
      project = current_user.owned_account.projects.create!(project_params)
    rescue => e
      render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity and return
    end
    
    render json: project.to_mini_json, status: :created
  end

  def project_params
    params.require(:project).permit(:name, :thread_id)
  end
end