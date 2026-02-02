class API::BaseController < ActionController::API
  include ActionController::Cookies
  include AbstractController::Translation
  include ActionController::Caching
  include Turbo::Native::Navigation

  include Accounts::SubscriptionStatus
  include ActiveStorage::SetCurrent
  include Authentication
  include Authorization
  include InternalAPIVerification
  include Pagy::Backend
  include SetCurrentRequestDetails
  include SetLocale
  include Sortable

  rate_limit to: 300, within: 1.minute,
    unless: -> { internal_api_request? || internal_service_call? },
    by: -> { current_user&.id || request.remote_ip },
    with: -> { render json: { error: "Rate limit exceeded. Try again later." }, status: :too_many_requests }

  rescue_from ActiveRecord::RecordNotFound, with: :not_found

  prepend_before_action :require_api_authentication
  prepend_before_action :verify_internal_api_signature, if: :internal_api_request?

  helper :all

  private

  def require_api_authentication
    return if user_signed_in?

    if (user = get_user)
      sign_in user, store: false
    else
      render json: { error: "Unauthorized" }, status: :unauthorized
    end
  end

  def get_user
    if api_token.present?
      api_token.user
    elsif internal_api_request? && jwt_user.present?
      jwt_user
    end
  end

  def token_from_header
    request.headers.fetch("Authorization", "").split(" ").last
  end

  def api_token
    @_api_token ||= APIToken.find_by(token: token_from_header)
  end

  # Only for use within authenticate_api_token! above
  # Use current_user/Current.user or current_account/Current.account within app controllers
  def user_from_token
    if api_token.present?
      api_token.touch(:last_used_at)
      api_token.user
    end
  end

  def not_found
    render json: { error: "Record not found" }, status: :not_found
  end
end
