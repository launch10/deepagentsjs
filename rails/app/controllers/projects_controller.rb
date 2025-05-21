class ProjectsController < SubscribedController
  def index
    binding.pry
    render inertia: 'Home', props: {
      jwt: current_user.jwt_payload
    }, layout: "layouts/webcontainer"
  end

  def show
    thread_id = Thread.find_by(
      account_id: current_account.id, 
      thread_id: params[:thread_id]
    )&.thread_id || nil

    render inertia: 'Home', props: {
      account_id: account.id,
      user_id: current_user.id,
      thread_id: thread_id # if account doesn't own this thread, will simply render the homepage
    }, layout: "layouts/webcontainer"
  end
end