class LanggraphCallbackClient < ApplicationClient
  # BASE_URI is dynamic per job_run, so we pass full URL to post()

  def initialize(callback_url:)
    @callback_url = callback_url
  end

  def deliver(payload)
    json_body = payload.to_json
    post(@callback_url, body: json_body, headers: signature_header(json_body))
  end

  private

  def authorization_header
    {} # No bearer token for webhooks, we use signature instead
  end

  def signature_header(json_body)
    {
      "X-Signature" => OpenSSL::HMAC.hexdigest(
        "SHA256",
        Rails.application.credentials.devise_jwt_secret_key!,
        json_body
      )
    }
  end

  def base_uri
    "" # We pass full URL to post()
  end
end
