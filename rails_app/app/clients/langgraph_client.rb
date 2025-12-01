class LanggraphClient < ApplicationClient
  BASE_URI = Langgraph.url

  def extract_qa_async(job_run_id:, document_id:, content:, metadata: {})
    post("/api/documents/extract-faqs", body: {
      job_run_id: job_run_id,
      document_id: document_id,
      content: content,
      metadata: metadata
    })
  end

  private

  def authorization_header
    { "Authorization" => "Bearer #{service_token}" }
  end

  def service_token
    @service_token ||= generate_service_token
  end

  def generate_service_token
    payload = {
      sub: "service",
      exp: 1.hour.from_now.to_i,
      iat: Time.current.to_i,
      jti: SecureRandom.uuid,
      service: true
    }
    JWT.encode(payload, Rails.application.credentials.devise_jwt_secret_key!, "HS256")
  end
end
