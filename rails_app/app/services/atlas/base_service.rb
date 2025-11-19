# frozen_string_literal: true

module Atlas
  class BaseService < ApplicationClient
    include ActiveSupport::Configurable

    config_accessor :base_url
    config_accessor :api_secret
    config_accessor :timeout, default: 30

    # Custom error classes for Atlas
    class ValidationError < Error; end

    class AuthenticationError < Error; end

    class NotFoundError < Error; end

    class ServerError < Error; end

    def initialize(auth: nil, basic_auth: nil, token: nil)
      super
    end

    # Override base_uri to use configured value
    def base_uri
      self.class.config.base_url
    end

    def default_headers
      timestamp = Time.now.to_i.to_s

      {
        "X-Timestamp" => timestamp,
        "Content-Type" => "application/json",
        "Accept" => "application/json"
      }
    end

    def open_timeout
      self.class.config.timeout
    end

    def read_timeout
      self.class.config.timeout
    end

    private

    def make_request(klass:, path:, headers: {}, body: nil, query: nil, form_data: nil, http_options: {})
      return if Rails.env.development? || Rails.env.test?

      # Calculate signature based on the request body
      body_for_signature = if body.present? && klass != Net::HTTP::Get
        build_body(body)
      else
        ""
      end

      timestamp = headers["X-Timestamp"] || default_headers["X-Timestamp"]
      signature = generate_signature(body_for_signature, timestamp)

      # Add signature to headers
      headers_with_signature = headers.merge("X-Signature" => signature)

      super(klass: klass, path: path, headers: headers_with_signature, body: body, query: query, form_data: form_data, http_options: http_options)
    end

    def generate_signature(body, timestamp)
      payload = "#{timestamp}.#{body}"
      OpenSSL::HMAC.hexdigest("SHA256", self.class.config.api_secret || "", payload)
    end

    def handle_response(response)
      case response.code
      when "200", "201", "202", "203", "204"
        response
      when "400"
        error_message = extract_error_message(response)
        raise ValidationError, error_message
      when "401"
        error_message = extract_error_message(response)
        raise AuthenticationError, error_message
      when "404"
        error_message = extract_error_message(response)
        raise NotFoundError, error_message
      when "500", "502", "503", "504"
        error_message = extract_error_message(response)
        raise ServerError, error_message
      else
        super # Fall back to parent's handling
      end
    end

    def extract_error_message(response)
      parsed = begin
        JSON.parse(response.body)
      rescue
        {}
      end
      parsed["error"] || parsed["message"] || response.body
    end
  end
end
