class Ahoy::Store < Ahoy::DatabaseStore
end

# set to true for JavaScript tracking
Ahoy.api = false

# false because we're not using this through Rails - we do it via Atlas (Cloudflare), so things are a little customized
Ahoy.geocode = false
