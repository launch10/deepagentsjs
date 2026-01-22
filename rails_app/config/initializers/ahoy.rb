class Ahoy::Store < Ahoy::DatabaseStore
end

# set to true for JavaScript tracking
Ahoy.api = false

# false because we're not using this through Rails - we do it via Atlas (Cloudflare), so things are a little customized
Ahoy.geocode = false

# Disable automatic server-side visit tracking on every request.
# We only track visits for user landing pages via Atlas/Cloudflare and api/v1/tracking_controller.
Ahoy.server_side_visits = false
