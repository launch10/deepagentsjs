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
    rescue ActiveRecord::RecordInvalid => e
      render json: {errors: e.record.errors.full_messages}, status: :unprocessable_entity and return
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
      location_targets: [:target_type, :location_name, :location_type, :country_code, :targeted, :google_criterion_id, :radius, :radius_units],
      ad_schedules: [:always_on, :start_time, :end_time, :time_zone, { day_of_week: [] }],
      ad_groups_attributes: [
        :id,
        :name,
        :_destroy,
        ads_attributes: [
          :id,
          :_destroy,
          headlines_attributes: [:id, :text, :position, :_destroy],
          descriptions_attributes: [:id, :text, :position, :_destroy]
        ],
        keywords_attributes: [:id, :text, :match_type, :position, :_destroy]
      ],
      callouts_attributes: [:id, :text, :position, :_destroy],
      structured_snippet_attributes: [:id, :category, :_destroy, { values: [] }]
    )
  end

  def campaign_json(campaign)
    workflow = campaign.project&.launch_workflow
    {
      id: campaign.id,
      name: campaign.name,
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
      ad_groups: campaign.ad_groups.map do |ad_group|
        {
          id: ad_group.id,
          name: ad_group.name,
          ads: ad_group.ads.map do |ad|
            {
              id: ad.id,
              headlines: ad.headlines.order(:position).map do |headline|
                {
                  id: headline.id,
                  text: headline.text,
                  position: headline.position
                }
              end,
              descriptions: ad.descriptions.order(:position).map do |description|
                {
                  id: description.id,
                  text: description.text,
                  position: description.position
                }
              end
            }
          end,
          keywords: ad_group.keywords.order(:position).map do |keyword|
            {
              id: keyword.id,
              text: keyword.text,
              match_type: keyword.match_type,
              position: keyword.position
            }
          end
        }
      end,
      callouts: campaign.callouts.order(:position).map do |callout|
        {
          id: callout.id,
          text: callout.text,
          position: callout.position
        }
      end,
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
