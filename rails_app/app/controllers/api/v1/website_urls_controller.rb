class API::V1::WebsiteUrlsController < API::BaseController
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
end
