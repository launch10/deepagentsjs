class API::V1::SocialLinksController < API::BaseController
  before_action :set_project
  before_action :set_social_link, only: [:show, :update, :destroy]

  def index
    @social_links = @project.social_links.order(:id)
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
  # Uses transaction for atomic behavior: all succeed or all rollback
  def bulk_upsert
    results = ActiveRecord::Base.transaction do
      social_links_params.map do |link_params|
        social_link = @project.social_links.find_or_initialize_by(platform: link_params[:platform])
        social_link.assign_attributes(link_params.except(:platform))
        social_link.save!
        social_link
      end
    end

    render json: results, status: :ok
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotUnique
    render json: { error: "Duplicate platform detected" }, status: :conflict
  end

  private

  def set_project
    @project = current_account.projects.find_by!(uuid: params[:project_uuid])
  end

  def set_social_link
    @social_link = @project.social_links.find(params[:id])
  end

  def social_link_params
    params.require(:social_link).permit(:platform, :url, :handle)
  end

  def social_links_params
    params.require(:social_links).map { |p| p.permit(:platform, :url, :handle) }
  end
end
