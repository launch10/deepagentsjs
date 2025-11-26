class ProjectsController < SubscribedController
  def new
    respond_to do |format|
      format.html do
        render inertia: "Brainstorm", layout: "layouts/webcontainer"
      end
    end
  end

  def show
    project = Project.with_launch_relations.find_by!(account_id: current_account.id, uuid: params[:uuid])

    if !project
      render json: { error: "Project not found" }, status: :not_found
    end

    campaign = project.campaigns.first # campaigns_controller#create ensures we'll only have one campaign
    if campaign
      ad_group = campaign.ad_groups.first
      ad = ad_group.ads.first
      headlines = campaign.headlines
      descriptions = campaign.descriptions
      languages = campaign.languages
      keywords = campaign.keywords
      location_targets = campaign.location_targets
      callouts = campaign.callouts
      structured_snippet = campaign.structured_snippet
      schedule = campaign.schedule
    end

    props = {
      thread_id: project.brainstorm.chat.thread_id,
      project: project.as_json,
      brainstorm: project.brainstorm.as_json,
      workflow: project.launch_workflow.as_json,
      chat: project.brainstorm.chat.as_json,
      website: project.website.as_json,
      ads_account: project.ads_account.as_json,
      ad_group: ad_group.as_json,
      ad: ad.as_json,
      headlines: headlines.as_json,
      descriptions: descriptions.as_json,
      languages: languages.as_json,
      keywords: keywords.as_json,
      location_targets: location_targets.as_json,
      callouts: callouts.as_json,
      structured_snippet: structured_snippet.as_json,
      ad_schedule: schedule.as_json,
    }
    render inertia: "Brainstorm", props: props, layout: "layouts/webcontainer"
  end
end
