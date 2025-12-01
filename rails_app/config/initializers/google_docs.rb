Rails.application.config.to_prepare do
  GoogleDocs::Client.configure do |config|
    config.credentials_path = Rails.root.join("..", "keys", "launch10-google-service-key.json").to_s
  end
end
