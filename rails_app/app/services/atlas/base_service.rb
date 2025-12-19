# frozen_string_literal: true

module Atlas
  class BaseService < ApplicationClient
    include ActiveSupport::Configurable

    config_accessor :base_url
    config_accessor :api_secret
    config_accessor :timeout, default: 30
    config_accessor :allow_sync, default: false

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
      puts "Syncing to cloudflare environment: #{cloud_environment}"

      {
        "X-Timestamp" => timestamp,
        "X-Environment" => cloud_environment,
        "Content-Type" => "application/json",
        "Accept" => "application/json"
      }
    end

    def cloud_environment
      Cloudflare.deploy_env.to_s
    end

    def open_timeout
      self.class.config.timeout
    end

    def read_timeout
      self.class.config.timeout
    end

    private

    def make_request(klass:, path:, headers: {}, body: nil, query: nil, form_data: nil, http_options: {})
      if (Rails.env.development? || Rails.env.test?) && !self.class.config.allow_sync
        puts "Skipping Atlas sync in dev/test environment"
        return
      end

      # Calculate signature based on the request body
      body_for_signature = if body.present? && klass != Net::HTTP::Get
        build_body(body)
      else
        ""
      end

      timestamp = headers["X-Timestamp"] || default_headers["X-Timestamp"]
      signature = generate_signature(body_for_signature, timestamp)

      Rails.logger.debug "[Atlas] Timestamp: #{timestamp}"
      Rails.logger.debug "[Atlas] Body for signature: #{body_for_signature.inspect}"
      Rails.logger.debug "[Atlas] Signature: #{signature}"
      Rails.logger.debug "[Atlas] Secret (first 4 chars): #{self.class.config.api_secret&.first(4)}..."

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
