class ProjectsController < SubscribedController
  def index
    _, projects_records = pagy(current_user.projects.order(id: :desc))
    projects = projects_records.map(&:to_mini_json)

    respond_to do |format|
      format.html do
        render inertia: 'Home', props: {
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
      project = creation_account.projects.create!(project_params)
      website = Website.create!(
        project_id: project.id, 
        name: project.name, 
        thread_id: project.thread_id,
        account_id: project.account_id
      )
      puts website.as_json
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

  def destroy
    project = current_account.projects.find_by(thread_id: params[:thread_id])
    if project.destroy
      head :no_content
    else
      render json: { errors: project.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def files
    files = current_project&.website&.code_files&.map(&:to_mini_json) || []
    render json: files
  end

private
  def current_project
    @project ||= current_account.projects.find_by(thread_id: params[:thread_id])
  end
  
  def creation_account
    @creation_account ||= begin
      if project_params[:account_id].present?
        account_id = project_params[:account_id]
        Account.find(account_id)
      else
        current_account
      end
    end
  end

  def project_params
    params.require(:project).permit(:name, :thread_id, :account_id, files_attributes: [:id, :path, :content, :file_type, :_destroy])
  end
end