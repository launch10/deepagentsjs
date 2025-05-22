class ProjectsController < SubscribedController
  def index
    render inertia: 'Home', props: {
      jwt: cookies[:jwt]
    }, layout: "layouts/webcontainer"
  end

  def show
    project = Project.find_by(
      account_id: current_account.id, 
      thread_id: params[:thread_id]
    )

    render inertia: 'Home', props: {
      account_id: account.id,
      user_id: current_user.id,
      thread_id: thread_id # if account doesn't own this thread, will simply render the homepage
    }, layout: "layouts/webcontainer"
  end

  def files
    if params[:thread_id]
    end
  end
end