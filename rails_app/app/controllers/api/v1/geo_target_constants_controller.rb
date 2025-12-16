class API::V1::GeoTargetConstantsController < API::BaseController
  def index
    locations = GeoTargetConstant.active.search_api(params[:location_query])
    render json: locations.map { |loc| location_json(loc) }
  end

  private

  def location_json(location)
    {
      id: location.id,
      criteria_id: location.criteria_id,
      name: location.name,
      canonical_name: location.canonical_name,
      country_code: location.country_code,
      target_type: location.target_type,
      status: location.status
    }
  end
end
