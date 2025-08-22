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

    def make_request(method, path, params = {})
      url = "#{config.base_url}#{path}"
      body = method == :get ? nil : params.to_json
      headers = build_headers(body)
      
      options = {
        method: method,
        headers: headers,
        timeout: config.timeout,
        connecttimeout: config.timeout / 2
      }
      
      if method == :get && params.any?
        url += "?#{URI.encode_www_form(params)}"
      elsif body
        options[:body] = body
      end
      
      request = Typhoeus::Request.new(url, options)
      response = request.run
      
      handle_typhoeus_response(response)
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

    def handle_typhoeus_response(response)
      if response.timed_out?
        raise Error, "Request timed out"
      elsif response.code == 0
        raise Error, "Connection failed: #{response.return_message}"
      end
      
      parsed_body = parse_response_body(response.body)
      
      case response.code
      when 200, 201
        parsed_body
      when 400
        raise ValidationError, error_message_from_body(parsed_body)
      when 401, 403
        raise AuthenticationError, error_message_from_body(parsed_body)
      when 404
        raise NotFoundError, error_message_from_body(parsed_body)
      when 500..599
        raise ServerError, error_message_from_body(parsed_body)
      else
        raise Error, "Unexpected response: #{response.code} - #{response.body}"
      end
    end
    
    def parse_response_body(body)
      return {} if body.nil? || body.empty?
      JSON.parse(body)
    rescue JSON::ParserError
      body
    end

    def error_message_from_body(body)
      if body.is_a?(Hash)
        body['error'] || body['message'] || body.to_s
      else
        body.to_s
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