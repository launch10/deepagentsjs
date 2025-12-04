class ProjectsController < SubscribedController
  before_action :set_project, except: [:new]

  def new
    respond_to do |format|
      format.html do
        render inertia: "Brainstorm",
          props: {
            thread_id: nil,
            project: { uuid: nil }
          },
          layout: "layouts/webcontainer"
      end
    end
  end

  def brainstorm
    render inertia: "Brainstorm", props: @project.to_brainstorm_json, layout: "layouts/webcontainer"
  end

  def website
    render inertia: "Website", props: @project.to_website_json, layout: "layouts/webcontainer"
  end

  WorkflowConfig.substeps_for("launch", "ad_campaign").each do |substep|
    define_method("campaigns_#{substep}") do
      render inertia: "Campaign",
        props: @project.to_ad_campaign_json,
        layout: "layouts/webcontainer"
    end
  end

  WorkflowConfig.substeps_for("launch", "launch").each do |substep|
    define_method("launch_#{substep}") do
      render inertia: "Launch",
        props: @project.to_launch_json,
        layout: "layouts/webcontainer"
    end
  end

  private

  def set_project
    @project = current_account.projects.find_by(uuid: params[:uuid])
    render json: { error: "Project not found" }, status: :not_found unless @project
  end
end
