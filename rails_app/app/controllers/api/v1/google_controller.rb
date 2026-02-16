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

  # POST /api/v1/google/refresh_invite_status
  # Live-checks Google for invite acceptance and returns result.
  # If accepted, completes the associated JobRun.
  # If not accepted, enqueues PollInviteAcceptanceWorker for a quick follow-up.
  def refresh_invite_status
    invitation = current_account.google_account_invitation
    unless invitation
      return render json: { accepted: false, status: "none", email: nil }
    end

    invitation.google_refresh_status

    job_run = find_running_invite_job

    if invitation.accepted? && job_run
      job_run.complete!({ status: "accepted" })
      job_run.notify_langgraph(status: "completed", result: { status: "accepted" })
    elsif !invitation.accepted? && job_run
      GoogleAds::PollInviteAcceptanceWorker.perform_async(job_run.id)
    end

    render json: {
      accepted: invitation.accepted?,
      status: invitation.google_status,
      email: invitation.email_address
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

  private

  def find_running_invite_job
    return unless params[:job_run_id].present?

    current_account.job_runs.running.find_by(id: params[:job_run_id], job_class: "GoogleAdsInvite")
  end
end
