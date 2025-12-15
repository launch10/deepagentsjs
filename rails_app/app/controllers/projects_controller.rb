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

  def show
    case @project.step
    when "brainstorm"
      redirect_to action: "brainstorm"
    when "website"
      redirect_to action: "website"
    when "ad_campaign"
      redirect_to action: "campaigns_#{@project.substep}"
    when "launch"
      redirect_to action: "launch_#{@project.substep}"
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
      @campaign = @project.campaigns.first
      if @campaign.present?
        # If this fails, it's because the user hasn't completed the previous steps
        # before the page they're trying to go to. We'll just stay on the same page.
        # Don't use update! here because it will raise an exception if the update fails.
        @campaign.update(stage: substep)
      end
      if @campaign.reload.stage != substep
        redirect_to action: "campaigns_#{@campaign.stage}" and return
      end

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
