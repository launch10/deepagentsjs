class API::V1::GoogleController < API::BaseController
  # GET /api/v1/google/connection_status
  # Returns whether account has connected Google OAuth
  def connection_status
    render json: {
      connected: current_account.has_google_connected_account?,
      email: current_account.google_email_address
    }
  end

  # GET /api/v1/google/invite_status
  # Returns whether Google Ads invite has been accepted
  def invite_status
    invitation = current_account.google_account_invitation
    render json: {
      accepted: invitation&.accepted? || false,
      status: invitation&.google_status || "none",
      email: invitation&.email_address
    }
  end
end
