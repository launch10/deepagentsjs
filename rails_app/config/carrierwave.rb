CarrierWave.configure do |config|
  config.storage = :aws
  config.aws_bucket = Cloudflare.config.uploads_bucket
  config.aws_acl = "public-read"
  config.asset_host = ENV.fetch("CLOUDFLARE_ASSET_HOST") do
    Rails.env.production? ? "https://uploads.launch10.ai" : "http://dev-uploads.launch10.ai"
  end

  config.aws_credentials = {
    access_key_id: Cloudflare.config.r2_access_key_id,
    secret_access_key: Cloudflare.config.r2_secret_access_key,
    region: "auto",
    endpoint: Cloudflare.config.r2_endpoint
  }
end