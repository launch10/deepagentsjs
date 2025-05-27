class ProjectsController < SubscribedController
  def index
    pagy_obj, projects_records = pagy(current_user.projects.order(id: :desc))
    projects = projects_records.map(&:to_mini_json)

    respond_to do |format|
      format.html do
        render inertia: 'Home', props: {
          jwt: cookies[:jwt],
          projects: projects,
          pagy: pagy_metadata(pagy_obj)
        }, layout: "layouts/webcontainer"
      end
      format.json do
        render json: {
          projects: projects,
          pagy: pagy_metadata(pagy_obj)
        }
      end
    end
  end

  def show
    # @project = Project.find_by(
    #   account_id: current_account.id, 
    #   thread_id: params[:thread_id]
    # )

    render inertia: 'Home', props: {
      jwt: cookies[:jwt],
      thread_id: params[:thread_id],
      # files: project.files
    }, layout: "layouts/webcontainer"
  end

  def create
    user = jwt_user # This request comes from Langgraph, so we need to get the user from the JWT
  end
end