# frozen_string_literal: true

module Atlas
  class BaseService
    include ActiveSupport::Configurable

    config_accessor :base_url, default: ENV.fetch('ATLAS_BASE_URL', 'http://localhost:8787')
    config_accessor :api_secret, default: ENV.fetch('ATLAS_API_SECRET', Rails.application.credentials.dig(:atlas, :api_secret))
    config_accessor :timeout, default: 30

    class Error < StandardError; end
    class AuthenticationError < Error; end
    class NotFoundError < Error; end
    class ValidationError < Error; end
    class ServerError < Error; end

    private

    def client
      @client ||= Faraday.new(url: config.base_url) do |faraday|
        faraday.request :json
        faraday.response :json
        faraday.options.timeout = config.timeout
        faraday.adapter Faraday.default_adapter
      end
    end

    def make_request(method, path, params = {})
      body = method == :get ? nil : params.to_json
      headers = build_headers(body)
      
      response = client.send(method, path) do |req|
        req.headers = headers
        req.params = params if method == :get
        req.body = body if body
      end

      handle_response(response)
    rescue Faraday::TimeoutError => e
      raise Error, "Request timed out: #{e.message}"
    rescue Faraday::ConnectionFailed => e
      raise Error, "Connection failed: #{e.message}"
    end

    def build_headers(body)
      timestamp = Time.now.to_i.to_s
      signature = generate_signature(body || '', timestamp)

      {
        'X-Timestamp' => timestamp,
        'X-Signature' => signature,
        'Content-Type' => 'application/json',
        'Accept' => 'application/json'
      }
    end

    def generate_signature(body, timestamp)
      payload = "#{timestamp}.#{body}"
      OpenSSL::HMAC.hexdigest('SHA256', config.api_secret, payload)
    end

    def handle_response(response)
      case response.status
      when 200, 201
        response.body
      when 400
        raise ValidationError, error_message(response)
      when 401, 403
        raise AuthenticationError, error_message(response)
      when 404
        raise NotFoundError, error_message(response)
      when 500..599
        raise ServerError, error_message(response)
      else
        raise Error, "Unexpected response: #{response.status} - #{response.body}"
      end
    end

    def error_message(response)
      if response.body.is_a?(Hash)
        response.body['error'] || response.body['message'] || response.body.to_s
      else
        response.body.to_s
      end
    end

    def log_request(method, path, params, response_time)
      Rails.logger.info "[Atlas] #{method.upcase} #{path} - #{response_time}ms"
      Rails.logger.debug "[Atlas] Params: #{params.inspect}" if params.present?
    end

    def with_logging(method, path, params = {})
      start_time = Time.current
      result = yield
      response_time = ((Time.current - start_time) * 1000).round(2)
      log_request(method, path, params, response_time)
      result
    rescue => e
      Rails.logger.error "[Atlas] Error: #{e.class} - #{e.message}"
      raise
    end
  end
end