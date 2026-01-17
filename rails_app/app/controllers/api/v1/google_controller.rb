class API::V1::GoogleController < API::BaseController
  # GET /api/v1/google/connection_status
  # Returns whether account has connected Google OAuth
  def connection_status
    binding.pry
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

  # GET /api/v1/google/payment_status
  # Returns whether Google Ads has a payment method configured
  def payment_status
    ads_account = current_account.ads_account
    return render json: { has_payment: false, status: "none" } unless ads_account

    render json: {
      has_payment: ads_account.google_billing_enabled?,
      status: ads_account.google_billing_status || "pending"
    }
  end
end
