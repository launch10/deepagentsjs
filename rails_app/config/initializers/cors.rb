# CORS configuration for cross-origin requests.
# Only the leads endpoint is public - all other APIs remain same-origin only.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "*"
    resource "/api/v1/leads",
      headers: ["Content-Type"],
      methods: [:post, :options],
      credentials: false, # Explicit: no cookies sent
      max_age: 600
  end
end
