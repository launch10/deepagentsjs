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
    project = Project.find_by(thread_id: params[:thread_id])
    if project && project.account_id != current_account.id
      flash[:error] = "You do not have access to this project"
      redirect_to root_path and return
    end

    render inertia: 'Home', props: {
      jwt: cookies[:jwt],
      thread_id: params[:thread_id],
      # files: project.files
    }, layout: "layouts/webcontainer"
  end

  def create
    begin
      project = current_account.projects.create!(project_params)
    rescue => e
      render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity and return
    end
    
    render json: project.to_mini_json, status: :created
  end

  def update
    @project = current_account.projects.find_by(thread_id: params[:thread_id])
    redirect_to root_path and return unless @project

    begin
      @project.update!(project_params)
    rescue => e
      render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity and return
    end

    render json: @project.to_mini_json
  end

  def project_params
    params.require(:project).permit(:name, :thread_id, files_attributes: [:id, :path, :content, :file_type, :_destroy])
  end
end