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

  def initialize_chat
    chat = @website.create_website_chat!(thread_id: params[:thread_id])
    render json: { chat_id: chat.id, thread_id: chat.thread_id }
  end

  private

  def set_website
    @website = current_account.websites.find(params[:id])
  end

  def website_params
    params.require(:website).permit(:theme_id)
  end
end
