# Clear JWT cookie on sign out to prevent stale authentication
# This fixes issues where the old JWT (with previous user's account_id)
# persists after logout and affects subsequent logins
Warden::Manager.before_logout do |user, auth, opts|
  auth.cookies.delete(:jwt, httponly: true, secure: Rails.env.production?, same_site: :lax)
end

# Track OAuth sign-ins via TrackEvent.
# Email/OTP sign-ins are tracked explicitly in SessionsController.
Warden::Manager.after_authentication do |user, auth, opts|
  next unless opts[:event] == :authentication
  # Only fire for OAuth — email/OTP tracked in SessionsController
  next unless auth.request.env["omniauth.auth"].present?

  provider = auth.request.env.dig("omniauth.auth", "provider") || "oauth"
  TrackEvent.call("user_signed_in",
    user: user,
    account: user.accounts.first,
    method: provider,
    days_since_signup: ((Time.current - user.created_at) / 1.day).round,
    has_projects: user.accounts.first&.projects&.exists? || false,
    project_count: user.accounts.first&.projects&.count || 0
  )
end
