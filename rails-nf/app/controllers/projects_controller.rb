class ProjectsController < SubscribedController
  def index
    render inertia: 'Home', props: {
      jwt: cookies[:jwt]
    }, layout: "layouts/webcontainer"
  end

  def show
    # project = Project.find_by(
    #   account_id: current_account.id, 
    #   thread_id: params[:thread_id]
    # )

    render inertia: 'Home', props: {
      jwt: cookies[:jwt],
      thread_id: params[:thread_id]
    }, layout: "layouts/webcontainer"
  end

  def files
    if params[:thread_id]
    end
  end
end