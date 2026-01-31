class API::V1::DomainsController < API::BaseController
  MAX_CANDIDATES = 10

  def search
    candidates = params[:candidates]

    if candidates.blank? || !candidates.is_a?(Array)
      render json: {errors: ["candidates parameter is required and must be an array"]}, status: :unprocessable_entity
      return
    end

    if candidates.length > MAX_CANDIDATES
      render json: {errors: ["Maximum #{MAX_CANDIDATES} candidates allowed"]}, status: :unprocessable_entity
      return
    end

    normalized_candidates = candidates.map { |c| normalize_domain(c) }.compact

    # Check global uniqueness using unscoped query
    existing_domains = Domain.unscoped.where(domain: normalized_candidates).index_by(&:domain)

    results = normalized_candidates.map do |domain_string|
      existing_domain = existing_domains[domain_string]

      if existing_domain.nil?
        {domain: domain_string, status: "available", existing_id: nil}
      elsif existing_domain.account_id == current_account.id
        {domain: domain_string, status: "existing", existing_id: existing_domain.id}
      else
        {domain: domain_string, status: "unavailable", existing_id: nil}
      end
    end

    render json: {
      results: results,
      platform_subdomain_credits: platform_subdomain_credits
    }
  end

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

  def update
    domain = current_account.domains.find_by(id: params[:id])

    unless domain
      render json: {errors: ["Not found"]}, status: :not_found and return
    end

    # Validate website_id belongs to current account if present
    if params[:domain][:website_id].present?
      website = current_account.websites.find_by(id: params[:domain][:website_id])
      unless website
        render json: {errors: ["Website not found"]}, status: :unprocessable_entity and return
      end
    end

    if domain.update(update_params)
      render json: domain.to_api_json
    else
      render json: {errors: domain.errors.full_messages}, status: :unprocessable_entity
    end
  end

  private

  def domain_params
    params.require(:domain).permit(:domain, :website_id, :is_platform_subdomain)
  end

  def update_params
    params.require(:domain).permit(:website_id)
  end

  def normalize_domain(domain_string)
    return nil if domain_string.blank?
    domain_string = domain_string.to_s.downcase.strip
    domain_string = domain_string.sub(/^https?:\/\//, "")
    domain_string.split("/").first
  end

  def platform_subdomain_credits
    limit = current_account.plan&.limit_for("platform_subdomains") || 0
    used = current_account.domains.platform_subdomains.count
    {
      limit: limit,
      used: used,
      remaining: [limit - used, 0].max
    }
  end
end
