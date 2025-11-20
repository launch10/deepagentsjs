class API::BaseController < ActionController::API
  include AbstractController::Translation
  include ActionController::Caching
  include Turbo::Native::Navigation

  include Accounts::SubscriptionStatus
  include ActiveStorage::SetCurrent
  include InternalAPIVerification
  include Authentication
  include Authorization
  include Pagy::Backend
  include SetCurrentRequestDetails
  include SetLocale
  include Sortable

  prepend_before_action :require_api_authentication
  prepend_before_action :verify_internal_api_signature, if: :internal_api_request?

  helper :all

  private

  def require_api_authentication
    return if user_signed_in?

    if (user = get_user)
      sign_in user, store: false
    else
      head :unauthorized
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
end
