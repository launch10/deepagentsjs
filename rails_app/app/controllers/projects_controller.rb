class ProjectsController < SubscribedController
  include ProjectsPagination

  before_action :set_project, except: [:index, :new]

  def index
    @pagy, projects = paginated_projects

    render inertia: "Projects",
      props: {
        projects: projects.map(&:to_mini_json),
        pagination: pagy_metadata(@pagy),
        status_counts: status_counts
      },
      layout: "layouts/webcontainer"
  end

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
      # Redirect to website substep (default to build)
      substep = @project.substep.presence || "build"
      redirect_to action: "website_#{substep}"
    when "ad_campaign"
      redirect_to action: "campaigns_#{@project.substep}"
    when "deploy"
      redirect_to action: "deploy"
    end
  end

  def brainstorm
    render inertia: "Brainstorm", props: @project.to_brainstorm_json, layout: "layouts/webcontainer"
  end

  # Dynamic website substep actions (build, domain)
  WorkflowConfig.substeps_for("launch", "website").each do |substep|
    next if substep == "deploy" # deploy is handled explicitly below

    define_method("website_#{substep}") do
      # Advance workflow step/substep
      @project.current_workflow.update!(step: "website", substep: substep)

      render inertia: "Website",
        props: @project.to_website_json.merge(substep: substep),
        layout: "layouts/webcontainer"
    end
  end

  def website_deploy
    @project.current_workflow.update!(step: "website", substep: "deploy")
    @deploy = find_existing_deploy

    render inertia: "Website",
      props: @project.to_website_deploy_json(@deploy),
      layout: "layouts/webcontainer"
  end

  WorkflowConfig.substeps_for("launch", "ad_campaign").each do |substep|
    define_method("campaigns_#{substep}") do
      @campaign = @project.campaigns.first
      if @campaign.present?
        # If this fails, it's because the user hasn't completed the previous steps
        # before the page they're trying to go to. We'll just stay on the same page.
        # Don't use update! here because it will raise an exception if the update fails.
        Campaign.transaction do
          @campaign.update!(stage: substep)
          @project.current_workflow.update!(substep: substep)
        end

        if @campaign.reload.stage != substep
          redirect_to action: "campaigns_#{@campaign.stage}" and return
        end
      end

      render inertia: "Campaign",
        props: @project.to_ad_campaign_json,
        layout: "layouts/webcontainer"
    end
  end

  def deploy
    @deploy = find_existing_deploy

    render inertia: "Deploy",
      props: @project.to_deploy_json(@deploy),
      layout: "layouts/webcontainer"
  end

  def destroy
    @project.destroy

    redirect_to projects_path, notice: "Project deleted successfully"
  end

  def restore
    @project.restore(recursive: true)

    redirect_to project_path(@project.uuid), notice: "Project restored successfully"
  end

  def performance
    render inertia: "ProjectPerformance", props: {
      project: @project.to_mini_json,
      metrics: all_metrics_for_date_ranges,
      date_range_options: [
        { days: 7, label: "Last 7 days" },
        { days: 30, label: "Last 30 days" },
        { days: 90, label: "Last 90 days" },
        { days: 0, label: "All time" }
      ]
    }
  end

  private

  def all_metrics_for_date_ranges
    [7, 30, 90, 0].each_with_object({}) do |days, hash|
      effective_days = (days == 0) ? days_since_first_data : days
      service = Analytics::ProjectPerformanceService.new(@project, days: effective_days)
      hash[days.to_s] = service.metrics
    end
  end

  def days_since_first_data
    first_metric = @project.analytics_daily_metrics.order(:date).first
    return 30 unless first_metric
    (Date.current - first_metric.date).to_i
  end

  # Find existing deploy — does NOT create. The graph's initDeploy node handles creation.
  # Returns the most recent deploy (which is always the one the graph created/is working on).
  def find_existing_deploy
    @project.deploys.order(created_at: :desc).first
  end

  def set_project
    @project = if action_name == "restore"
      # For restore, only find soft-deleted projects
      current_account.projects.only_deleted.find_by(uuid: params[:uuid])
    else
      current_account.projects.find_by(uuid: params[:uuid])
    end
    redirect_to root_path unless @project
  end
end
