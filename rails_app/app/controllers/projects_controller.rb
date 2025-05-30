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
    project = current_project
    if project.nil? || project.account_id != current_account.id
      flash[:error] = "You do not have access to this project"
      redirect_to root_path and return
    end

    respond_to do |format|
      format.html do
        render inertia: 'Home', props: {
          jwt: cookies[:jwt],
          thread_id: project.thread_id,
        }, layout: "layouts/webcontainer"
      end
      format.json do
        render json: project.to_mini_json
      end
    end
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
    redirect_to root_path and return unless current_project

    begin
      current_project.update!(project_params)
    rescue => e
      render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity and return
    end

    render json: current_project.to_mini_json
  end

  def files
    template_files = Template.find_by(name: "default").files
    template_files_by_key = template_files.index_by(&:path)
    project_files = current_project&.files || []
    project_files_by_key = project_files.index_by(&:path)

    files = (project_files_by_key.keys + template_files_by_key.keys).uniq.map do |path|
      project_files_by_key[path] || template_files_by_key[path]
    end

    render json: files.map(&:to_mini_json)
  end

private
  def current_project
    @project ||= current_account.projects.find_by(thread_id: params[:thread_id])
  end

  def project_params
    params.require(:project).permit(:name, :thread_id, files_attributes: [:id, :path, :content, :file_type, :_destroy])
  end
end