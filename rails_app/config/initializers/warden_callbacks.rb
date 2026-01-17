# Clear JWT cookie on sign out to prevent stale authentication
# This fixes issues where the old JWT (with previous user's account_id)
# persists after logout and affects subsequent logins
Warden::Manager.before_logout do |user, auth, opts|
  auth.cookies.delete(:jwt, httponly: true, secure: Rails.env.production?, same_site: :lax)
end
