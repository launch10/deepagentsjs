# Hotwire Native notification token management
class API::V1::NotificationTokensController < API::BaseController
  def create
    current_user.notification_tokens.find_or_create_by!(
      token: params[:token],
      platform: params[:platform]
    )
    render json: {}, status: :created
  end

  def destroy
    current_user.notification_tokens.find_by!(token: params[:token]).destroy
    render json: {}
  end
end
