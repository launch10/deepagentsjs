# Theoertical module for deploying to Cloudflare
module Deploy
  module HttpService
    # Maybe track every http request somewhere for full auditability
    # And make this a subclass of some higher-level service for tracking
    # .... 
    URL = "http://localhost:3000" # Setup Cloudflare deployment URL as environment variable
    ENDPOINT = "/api/v1/deploy" # Setup Cloudflare deployment endpoint as environment variable

    def run(data)
      headers = headers(data)
      # Or Faraday...
      response = HTTP.post("#{URL}#{ENDPOINT}", headers: headers, json: data)
      
      if response.status.success?
        true
      else
        false
      end
    end

    def generate_signature(body, timestamp)
      secret = ENV['INTERNAL_API_SECRET']
      payload = "#{timestamp}.#{body}"
      OpenSSL::HMAC.hexdigest('SHA256', secret, payload)
    end

    def headers(data)
      timestamp = Time.now.to_i
      body = data.to_json
      signature = generate_signature(body, timestamp)

      {
        'X-Timestamp' => timestamp.to_s,
        'X-Signature' => signature,
        'Content-Type' => 'application/json'
      }
    end
  end
end