class ProjectsController < SubscribedController
  def index
    render inertia: 'Home', props: {
      jwt: cookies[:jwt]
    }, layout: "layouts/webcontainer"
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
end