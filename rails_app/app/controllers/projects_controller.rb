class ProjectsController < SubscribedController
  before_action :set_project, except: [:index, :new]

  def index
    projects = current_account.projects
      .includes(website: :domains)
      .order(updated_at: :desc)
    render inertia: "Projects",
      props: {
        projects: projects.map(&:to_mini_json),
        total_count: projects.count
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
      redirect_to action: "website"
    when "ad_campaign"
      redirect_to action: "campaigns_#{@project.substep}"
    when "deploy"
      redirect_to action: "deploy"
    end
  end

  def brainstorm
    render inertia: "Brainstorm", props: @project.to_brainstorm_json, layout: "layouts/webcontainer"
  end

  def website
    # Advance workflow step when navigating to website
    @project.current_workflow.update!(step: "website") if @project.current_workflow.step != "website"
    render inertia: "Website", props: @project.to_website_json, layout: "layouts/webcontainer"
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
    # Create or find existing deploy for this project
    @deploy = @project.deploys.in_progress.first || @project.deploys.create!(status: "pending")

    render inertia: "Deploy",
      props: @project.to_deploy_json(@deploy),
      layout: "layouts/webcontainer"
  end

  def destroy
    @project.destroy

    redirect_to projects_path, notice: "Project deleted successfully"
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

  def set_project
    @project = current_account.projects.find_by(uuid: params[:uuid])
    render json: { error: "Project not found" }, status: :not_found unless @project
  end
end
