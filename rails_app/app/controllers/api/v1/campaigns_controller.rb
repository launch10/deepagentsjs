class API::V1::CampaignsController < API::BaseController
  def create
    begin
      existing_campaign = current_account.campaigns.find_by(project_id: create_params[:project_id])
      if existing_campaign
        render json: campaign_json(existing_campaign), status: :ok and return
      end
      result = Campaign.create_campaign!(current_account, create_params)
      campaign = result[:campaign]
    rescue ActiveRecord::RecordInvalid => e
      render json: {errors: e.record.errors.full_messages}, status: :unprocessable_entity and return
    rescue => e
      render json: {errors: [e.message]}, status: :unprocessable_entity and return
    end

    render json: campaign_json(campaign), status: :created
  end

  def update
    campaign = current_campaign

    unless campaign
      render json: {errors: ["Campaign not found"]}, status: :not_found and return
    end

    begin
      campaign.update_idempotently!(campaign_params.to_h)
    rescue CampaignConcerns::Updating::UpdateValidationError => e
      render json: {errors: e.errors}, status: :unprocessable_entity and return
    rescue ActiveRecord::RecordInvalid => e
      render json: {errors: e.record.errors.full_messages}, status: :unprocessable_entity and return
    rescue ActiveRecord::RecordNotFound => e
      # Return field-keyed errors for better frontend handling
      field = e.message.include?("GeoTargetConstant") ? "location_targets" : "base"
      render json: {errors: {field => [e.message]}}, status: :unprocessable_entity and return
    rescue => e
      render json: {errors: [e.message]}, status: :unprocessable_entity and return
    end

    render json: campaign_json(campaign)
  end

  def advance
    campaign = current_campaign

    unless campaign
      render json: {errors: ["Campaign not found"]}, status: :not_found and return
    end

    begin
      campaign.advance_stage!
    rescue ActiveRecord::RecordInvalid => e
      render json: {errors: e.record.errors.full_messages}, status: :unprocessable_entity and return
    end

    render json: campaign_json(campaign)
  end

  def back
    campaign = current_campaign

    unless campaign
      render json: {errors: ["Campaign not found"]}, status: :not_found and return
    end

    begin
      campaign.back_stage!
    rescue ActiveRecord::RecordInvalid => e
      render json: {errors: e.record.errors.full_messages}, status: :unprocessable_entity and return
    end

    render json: campaign_json(campaign)
  end

  private

  def current_campaign
    current_account.campaigns.find_by(id: params[:id])
  end

  def create_params
    params.require(:campaign).permit(:name, :project_id, :website_id)
  end

  def campaign_params
    params.require(:campaign).permit(
      :name,
      :start_date,
      :end_date,
      :time_zone,
      :daily_budget_cents,
      :google_advertising_channel_type,
      :google_bidding_strategy,
      **flat_attributes,
      **nested_attributes
    )
  end

  def flat_attributes
    {
      ad_schedules: [:always_on, :start_time, :end_time, :time_zone, { day_of_week: [] }],
      headlines: [:id, :text, :position],
      descriptions: [:id, :text, :position],
      keywords: [:id, :text, :match_type, :position],
      callouts: [:id, :text, :position],
      structured_snippet: [:category, :_destroy, { values: [] }],
      # GeoTargetConstant format: criteria_id, name, target_type (location type), country_code, targeted
      location_targets: [:criteria_id, :name, :target_type, :country_code, :targeted],
      ad_group: [:name]
    }
  end

  # We support both flat and nested attributes for flexibility
  def nested_attributes
    {
      ad_groups_attributes: [
        :id,
        :name,
        ads_attributes: [
          :id,
          headlines_attributes: [:id, :text, :position],
          descriptions_attributes: [:id, :text, :position]
        ],
        keywords_attributes: [:id, :text, :match_type, :position]
      ],
      callouts_attributes: [:id, :text, :position],
      structured_snippet_attributes: [:id, :category, :_destroy, { values: [] }]
    }
  end

  def eager_load(campaign)
    Campaign
      .includes(
        :structured_snippet,
        callouts: [],
        project: :workflows,
        ad_groups: [
          :keywords,
          ads: [:headlines, :descriptions]
        ]
      )
      .find(campaign.id)
  end

  def campaign_json(campaign)
    campaign = eager_load(campaign)

    ad_group = campaign.ad_groups.first
    ad = ad_group&.ads&.first
    workflow = campaign.project&.launch_workflow

    {
      id: campaign.id,
      name: campaign.name,
      thread_id: campaign.thread_id,
      stage: campaign.stage,
      status: campaign.status,
      ready_for_next_stage: campaign.ready_for_next_stage?,
      account_id: campaign.account_id,
      project_id: campaign.project_id,
      website_id: campaign.website_id,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      time_zone: campaign.time_zone,
      daily_budget_cents: campaign.daily_budget_cents,
      google_advertising_channel_type: campaign.google_advertising_channel_type,
      google_bidding_strategy: campaign.google_bidding_strategy,
      workflow: workflow ? {step: workflow.step, substep: workflow.substep} : nil,
      ad_group: ad_group ? {
        id: ad_group.id,
        name: ad_group.name
      } : nil,
      headlines: ad ? ad.headlines.order(:position).map { |h| { id: h.id, text: h.text, position: h.position } } : [],
      descriptions: ad ? ad.descriptions.order(:position).map { |d| { id: d.id, text: d.text, position: d.position } } : [],
      keywords: ad_group ? ad_group.keywords.order(:position).map { |k| { id: k.id, text: k.text, match_type: k.match_type, position: k.position } } : [],
      callouts: campaign.callouts.order(:position).map { |c| { id: c.id, text: c.text, position: c.position } },
      structured_snippet: campaign.structured_snippet ? {
        id: campaign.structured_snippet.id,
        category: campaign.structured_snippet.category,
        values: campaign.structured_snippet.values
      } : nil,
      created_at: campaign.created_at,
      updated_at: campaign.updated_at
    }
  end
end
