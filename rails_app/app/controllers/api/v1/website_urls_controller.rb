class API::V1::WebsiteUrlsController < API::BaseController
  MAX_CANDIDATES = 10

  def search
    domain_id = params[:domain_id]
    candidates = params[:candidates]

    if domain_id.blank?
      render json: {errors: ["domain_id parameter is required"]}, status: :unprocessable_entity
      return
    end

    # Verify domain belongs to current account
    domain = current_account.domains.find_by(id: domain_id)
    unless domain
      render json: {errors: ["Domain not found"]}, status: :not_found
      return
    end

    if candidates.blank? || !candidates.is_a?(Array)
      render json: {errors: ["candidates parameter is required and must be an array"]}, status: :unprocessable_entity
      return
    end

    if candidates.length > MAX_CANDIDATES
      render json: {errors: ["Maximum #{MAX_CANDIDATES} candidates allowed"]}, status: :unprocessable_entity
      return
    end

    normalized_candidates = candidates.map { |c| normalize_path(c) }

    # Check global uniqueness for this domain using unscoped query
    existing_urls = WebsiteUrl.unscoped
      .where(domain_id: domain_id, path: normalized_candidates)
      .index_by(&:path)

    results = normalized_candidates.map do |path|
      existing_url = existing_urls[path]

      if existing_url.nil?
        {path: path, status: "available", existing_id: nil, existing_website_id: nil}
      elsif existing_url.account_id == current_account.id
        {path: path, status: "existing", existing_id: existing_url.id, existing_website_id: existing_url.website_id}
      else
        {path: path, status: "unavailable", existing_id: nil, existing_website_id: nil}
      end
    end

    render json: {
      domain_id: domain.id,
      domain: domain.domain,
      results: results
    }
  end

  def index
    website_urls = current_account.website_urls
    website_urls = website_urls.where(website_id: params[:website_id]) if params[:website_id].present?
    website_urls = website_urls.where(domain_id: params[:domain_id]) if params[:domain_id].present?

    render json: {website_urls: website_urls.map(&:to_api_json)}
  end

  def show
    website_url = current_account.website_urls.find_by(id: params[:id])

    unless website_url
      render json: {errors: ["Not found"]}, status: :not_found and return
    end

    render json: website_url.to_api_json
  end

  def create
    website_url = current_account.website_urls.build(website_url_params)

    if website_url.save
      render json: website_url.to_api_json, status: :created
    else
      render json: {errors: website_url.errors.full_messages}, status: :unprocessable_entity
    end
  end

  def update
    website_url = current_account.website_urls.find_by(id: params[:id])

    unless website_url
      render json: {errors: ["Not found"]}, status: :not_found and return
    end

    if website_url.update(website_url_params)
      render json: website_url.to_api_json
    else
      render json: {errors: website_url.errors.full_messages}, status: :unprocessable_entity
    end
  end

  private

  def website_url_params
    params.require(:website_url).permit(:domain_id, :website_id, :path)
  end

  def normalize_path(path_string)
    return "/" if path_string.blank?
    path = path_string.to_s.strip
    path = "/#{path}" unless path.start_with?("/")
    path = path.chomp("/") unless path == "/"
    path
  end
end
