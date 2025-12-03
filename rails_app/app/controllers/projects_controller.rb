class ProjectsController < SubscribedController
  def new
    respond_to do |format|
      format.html do
        render inertia: "Brainstorm", layout: "layouts/webcontainer"
      end
    end
  end

  def show
    project = current_account.projects.find_by(uuid: params[:uuid])

    if !project
      render json: { error: "Project not found" }, status: :not_found
    end

    render inertia: "Headlines", props: project.serialize, layout: "layouts/webcontainer"
  end
end