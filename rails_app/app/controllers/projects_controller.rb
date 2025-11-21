class ProjectsController < SubscribedController
  def new
    respond_to do |format|
      format.html do
        render inertia: "Brainstorm", layout: "layouts/webcontainer"
      end
    end
  end

  def show
    project = current_account.projects.find_by!(uuid: params[:uuid])
    props = {
      thread_id: project.brainstorm.chat.thread_id,
      project: project.as_json,
      brainstorm: project.brainstorm.as_json,
      workflow: project.launch_workflow.as_json,
      chat: project.brainstorm.chat.as_json,
    }
    render inertia: "Brainstorm", props: props, layout: "layouts/webcontainer"
  end
end
