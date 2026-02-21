# Creates a Google OAuth ConnectedAccount so the OAuth step is skipped during deploy.
#
# Usage:
#   await appScenario('create_google_connected_account', { email: "test_user@launch10.ai" })
#
# Options:
#   email:        string - User's email (required)
#   google_email: string - Google account email (default: "test@launch10.ai")

email = command_options["email"] || command_options[:email]
raise "email is required" unless email.present?

google_email = command_options["google_email"] || command_options[:google_email] || "test@launch10.ai"

user = User.find_by!(email: email)

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

logger.info "[create_google_connected_account] Created ConnectedAccount for user=#{email} google_email=#{google_email}"

{ status: "ok", connected_account_id: connected.id, google_email: google_email }
