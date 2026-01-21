class LanggraphCacheClient < ApplicationClient
  def clear_llm_cache
    json_body = {timestamp: Time.current.to_i}.to_json
    post(callback_url, body: json_body, headers: signature_header(json_body))
  end

  private

  def callback_url
    "#{base_uri}/webhooks/clear_llm_cache"
  end

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
    ENV["LANGGRAPH_API_URL"] || "http://localhost:4000"
  end
end
