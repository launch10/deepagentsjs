CarrierWave.configure do |config|
  # R2 storage for production and development
  # Local storage for all tests (RSpec and Playwright E2E)
  use_local_storage = Rails.env.test? && ENV["USE_R2_STORAGE"] != "true"

  if use_local_storage
    config.storage = :file
    # Store in public/ so Rails serves the files directly
    config.root = Rails.root.join("public")
    # Enable processing for E2E tests (PLAYWRIGHT=true), disable for unit tests (speed)
    config.enable_processing = ENV["PLAYWRIGHT"] == "true"
    # For E2E tests, use localhost so uploaded files are actually accessible in browser
    # For unit tests, use CDN (test snapshots reference files that already exist there)
    if ENV["PLAYWRIGHT"] == "true"
      # RAILS_PORT is set by config/services.sh (3001 for test, 3000 for dev)
      rails_port = ENV.fetch("RAILS_PORT", 3001)
      config.asset_host = "http://localhost:#{rails_port}"
    else
      config.asset_host = "https://dev-uploads.launch10.ai"
    end
  else
    config.storage = :aws
    config.aws_bucket = ENV.fetch("CLOUDFLARE_UPLOADS_BUCKET") do
      Rails.application.credentials.dig(:cloudflare, :uploads_bucket) || (Rails.env.production? ? "uploads" : "dev-uploads")
    end
    config.aws_acl = "public-read"
    config.asset_host = ENV.fetch("CLOUDFLARE_ASSET_HOST") do
      Rails.env.production? ? "https://uploads.launch10.ai" : "https://dev-uploads.launch10.ai"
    end

    config.aws_credentials = {
      access_key_id: Rails.application.credentials.dig(:cloudflare, :r2_access_key_id),
      secret_access_key: Rails.application.credentials.dig(:cloudflare, :r2_secret_access_key),
      region: "auto",
      endpoint: Rails.application.credentials.dig(:cloudflare, :r2_endpoint),
      ssl_verify_peer: Rails.env.production?
    }

    # Security headers for uploaded files
    # SVG files are sanitized on upload (see MediaUploader), but we also set
    # defensive headers to prevent script execution if served inline.
    config.aws_attributes = lambda { |file|
      attrs = {
        # Prevent MIME type sniffing attacks (AWS SDK uses metadata hash, not x-amz-meta- prefix)
        metadata: {
          "x-content-type-options" => "nosniff"
        }
      }

      # For SVG files, force download to prevent inline script execution
      if file&.content_type == "image/svg+xml"
        attrs[:content_disposition] = "attachment"
      end

      attrs
    }
  end
end
