class API::V1::WebsitesController < API::BaseController
  before_action :set_project
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

  def set_project
    @project = current_account.projects.find_by!(uuid: params[:project_uuid])
  end

  def set_website
    @website = @project.website
    head :not_found unless @website
  end

  def website_params
    params.require(:website).permit(:theme_id)
  end
end
