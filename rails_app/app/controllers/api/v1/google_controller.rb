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
      Rails.logger.info "[VerifyGoogle::refresh_invite_status] #{Time.current.iso8601(3)} account=#{current_account.id} NO invitation found"
      return render json: { accepted: false, status: "none", email: nil }
    end

    status_before = invitation.google_status
    Rails.logger.info "[VerifyGoogle::refresh_invite_status] #{Time.current.iso8601(3)} account=#{current_account.id} invitation=#{invitation.id} status_before=#{status_before} email=#{invitation.email_address}"

    invitation.google_refresh_status

    invitation.reload
    status_after = invitation.google_status
    Rails.logger.info "[VerifyGoogle::refresh_invite_status] #{Time.current.iso8601(3)} account=#{current_account.id} invitation=#{invitation.id} status_after=#{status_after} accepted=#{invitation.accepted?} changed=#{status_before != status_after}"

    job_run = find_running_invite_job
    Rails.logger.info "[VerifyGoogle::refresh_invite_status] #{Time.current.iso8601(3)} account=#{current_account.id} job_run_id=#{params[:job_run_id]} found_job_run=#{job_run&.id} job_run_status=#{job_run&.status}"

    if invitation.accepted? && job_run
      Rails.logger.info "[VerifyGoogle::refresh_invite_status] #{Time.current.iso8601(3)} COMPLETING job_run=#{job_run.id} — invite accepted!"
      job_run.complete!({ status: "accepted" })
      job_run.notify_langgraph(status: "completed", result: { status: "accepted" })
    elsif !invitation.accepted? && job_run
      Rails.logger.info "[VerifyGoogle::refresh_invite_status] #{Time.current.iso8601(3)} ENQUEUING PollInviteAcceptanceWorker for job_run=#{job_run.id} — invite not yet accepted (status=#{status_after})"
      GoogleAds::PollInviteAcceptanceWorker.perform_async(job_run.id)
    elsif invitation.accepted? && !job_run
      Rails.logger.warn "[VerifyGoogle::refresh_invite_status] #{Time.current.iso8601(3)} invite ACCEPTED but no running job_run found! job_run_id_param=#{params[:job_run_id]}"
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
