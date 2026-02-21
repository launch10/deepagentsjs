# Simulates Google OAuth completion (the ONE flow that's a browser redirect, not an API call).
#
# Replicates what OmniauthCallbacksController#google_oauth2_connected does:
# 1. Creates a ConnectedAccount for the user
# 2. Finds the pending GoogleOAuthConnect job_run
# 3. Completes it and notifies Langgraph
#
# Usage:
#   await appScenario('complete_oauth', { email: "test_user@launch10.ai" })
#
# Options:
#   email:        string - User's email to find account (required)
#   google_email: string - Google account email (default: "test@launch10.ai")

email = command_options["email"] || command_options[:email]
raise "email is required" unless email.present?

google_email = command_options["google_email"] || command_options[:google_email] || "test@launch10.ai"

user = User.find_by!(email: email)
account = user.owned_account

# Create ConnectedAccount (same as OmniAuth callback would)
connected = user.connected_accounts.find_or_initialize_by(provider: "google_oauth2")
connected.uid = connected.uid.presence || SecureRandom.hex
connected.access_token = "mock_access_token_#{SecureRandom.hex(8)}"
connected.refresh_token = "mock_refresh_token_#{SecureRandom.hex(8)}"
connected.auth = {
  "provider" => "google_oauth2",
  "uid" => connected.uid,
  "info" => {
    "email" => google_email,
    "name" => "E2E Test User"
  },
  "credentials" => {
    "token" => connected.access_token,
    "refresh_token" => connected.refresh_token,
    "expires_at" => 1.hour.from_now.to_i
  }
}
connected.save!

# Find and complete the pending OAuth job_run.
# Try deploy-scoped first, then account-scoped (job_run may have deploy_id=NULL).
active_deploy = Deploy.joins(project: :account)
  .where(projects: { account_id: account.id })
  .in_progress
  .order(created_at: :desc)
  .first

job_run = nil

if active_deploy
  job_run = active_deploy.job_runs
    .where(job_class: "GoogleOAuthConnect", status: %w[pending running])
    .order(created_at: :desc)
    .first
end

# Fall back to account-level search (job_run may have deploy_id=NULL)
job_run ||= account.job_runs
  .where(job_class: "GoogleOAuthConnect", status: %w[pending running])
  .order(created_at: :desc)
  .first

if job_run
  job_run.complete!({ google_email: google_email })
  job_run.notify_langgraph(status: "completed", result: { google_email: google_email })
  logger.info "[complete_oauth] Completed job_run=#{job_run.id} for user=#{email} google_email=#{google_email}"
else
  logger.warn "[complete_oauth] No pending GoogleOAuthConnect job_run found for account=#{account.id}"
end

{
  status: "ok",
  email: google_email,
  connected_account_id: connected.id,
  job_run_id: job_run&.id
}
