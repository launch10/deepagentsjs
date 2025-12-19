class API::V1::DomainsController < API::BaseController
  def index
    domains = current_account.domains
    domains = domains.where(website_id: params[:website_id]) if params[:website_id].present?

    render json: {domains: domains.map(&:to_api_json)}
  end

  def show
    domain = current_account.domains.find_by(id: params[:id])

    unless domain
      render json: {errors: ["Not found"]}, status: :not_found and return
    end

    render json: domain.to_api_json
  end

  def create
    domain = current_account.domains.build(domain_params)

    if domain.save
      render json: domain.to_api_json, status: :created
    else
      render json: {errors: domain.errors.full_messages}, status: :unprocessable_entity
    end
  end

  private

  def domain_params
    params.require(:domain).permit(:domain, :website_id, :is_platform_subdomain)
  end
end
