CarrierWave.configure do |config|
  if Rails.env.test?
    config.storage = :file
    config.enable_processing = false
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
        # Prevent MIME type sniffing attacks
        "x-amz-meta-x-content-type-options" => "nosniff"
      }

      # For SVG files, force download to prevent inline script execution
      if file&.content_type == "image/svg+xml"
        attrs["content_disposition"] = "attachment"
      end

      attrs
    }
  end
end
