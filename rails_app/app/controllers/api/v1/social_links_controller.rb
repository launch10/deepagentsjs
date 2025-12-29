class API::V1::SocialLinksController < API::BaseController
  before_action :set_project
  before_action :set_social_link, only: [:show, :update, :destroy]

  def index
    @social_links = @project.social_links.order(:platform)
    render json: @social_links
  end

  def show
    render json: @social_link
  end

  def create
    @social_link = @project.social_links.build(social_link_params)

    if @social_link.save
      render json: @social_link, status: :created
    else
      render json: { errors: @social_link.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @social_link.update(social_link_params)
      render json: @social_link
    else
      render json: { errors: @social_link.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @social_link.destroy
    head :no_content
  end

  # Bulk upsert - creates or updates multiple social links at once
  def bulk_upsert
    results = []
    errors = []

    social_links_params.each do |link_params|
      social_link = @project.social_links.find_or_initialize_by(platform: link_params[:platform])
      social_link.assign_attributes(link_params.except(:platform))

      if social_link.save
        results << social_link
      else
        errors << { platform: link_params[:platform], errors: social_link.errors.full_messages }
      end
    end

    if errors.empty?
      render json: results, status: :ok
    else
      render json: { social_links: results, errors: errors }, status: :unprocessable_entity
    end
  end

  private

  def set_project
    @project = current_account.projects.find_by!(uuid: params[:project_uuid])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Project not found" }, status: :not_found
  end

  def set_social_link
    @social_link = @project.social_links.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Social link not found" }, status: :not_found
  end

  def social_link_params
    params.require(:social_link).permit(:platform, :url, :handle)
  end

  def social_links_params
    params.require(:social_links).map { |p| p.permit(:platform, :url, :handle) }
  end
end
