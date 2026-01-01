CarrierWave.configure do |config|
  # Use local file storage for test environment or when explicitly requested
  # Set USE_LOCAL_STORAGE=true for E2E tests to avoid hitting R2
  use_local_storage = Rails.env.test? || ENV["USE_LOCAL_STORAGE"] == "true"

  if use_local_storage
    config.storage = :file
    # Disable processing in unit tests for speed, but keep it for E2E (USE_LOCAL_STORAGE)
    config.enable_processing = ENV["USE_LOCAL_STORAGE"] == "true"
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
