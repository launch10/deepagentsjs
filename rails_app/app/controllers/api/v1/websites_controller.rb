class API::V1::WebsitesController < API::BaseController
  before_action :set_website

  def show
    render json: @website.as_json(only: [:id, :name, :theme_id])
  end

  def update
    if @website.update(website_params)
      render json: @website.as_json(only: [:id, :name, :theme_id])
    else
      render json: { errors: @website.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def set_website
    @website = current_account.websites.find(params[:id])
  end

  def website_params
    params.require(:website).permit(:theme_id)
  end
end
