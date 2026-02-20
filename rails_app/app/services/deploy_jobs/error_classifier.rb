module DeployJobs
  module ErrorClassifier
    NET_HTTP_ERRORS = [
      Timeout::Error, Errno::EINVAL, Errno::ECONNRESET, Errno::ECONNREFUSED,
      Errno::EPIPE, Errno::EBADF, Errno::EHOSTUNREACH, Errno::ENETUNREACH,
      EOFError, IOError, Net::HTTPBadResponse, Net::HTTPHeaderSyntaxError,
      Net::ProtocolError, OpenSSL::SSL::SSLError
    ].freeze

    # Classify a raw exception into a shared ErrorType symbol.
    def self.classify(error)
      # 1. Typed ApplicationClient errors (most specific)
      case error
      when ApplicationClient::RateLimit
        return :rate_limit
      when ApplicationClient::NotFound
        return :not_found
      when ApplicationClient::Unauthorized, ApplicationClient::Forbidden
        return :auth_failure
      when ApplicationClient::InternalError
        return :api_outage
      when ApplicationClient::Error
        return :api_outage
      end

      # 2. Google Ads errors (delegate to TerminalErrors)
      if defined?(Google::Ads::GoogleAds::Errors::GoogleAdsError) &&
          error.is_a?(Google::Ads::GoogleAds::Errors::GoogleAdsError)
        return classify_google_ads_error(error)
      end

      # 3. ActiveRecord errors
      return :not_found if error.is_a?(ActiveRecord::RecordNotFound)

      # 4. Lock contention (transient)
      return :api_outage if error.is_a?(Lockable::LockNotAcquiredError)

      # 5. Timeout errors
      return :timeout if error.is_a?(Timeout::Error)

      # 6. Network errors (by class)
      return :api_outage if NET_HTTP_ERRORS.any? { |klass| error.is_a?(klass) }

      # 7. Argument/type errors (bad data)
      return :invalid_data if error.is_a?(ArgumentError) || error.is_a?(TypeError)

      # 8. Generic StandardError/RuntimeError — caller is probably wrapping the real exception.
      # Alert so we can fix the caller to raise a more specific type.
      if error.instance_of?(StandardError) || error.instance_of?(RuntimeError)
        Sentry.capture_message(
          "Generic #{error.class} reached ErrorClassifier — caller should raise a specific error type",
          level: :warning,
          extra: { message: error.message, backtrace: error.backtrace&.first(5) }
        )
      end

      # 9. Message-based fallback
      classify_by_message(error.message)
    end

    class << self
      private

      def classify_google_ads_error(error)
        if GoogleAds::TerminalErrors.terminal?(error)
          if policy_error?(error)
            :policy_violation
          elsif auth_error?(error)
            :auth_failure
          else
            :invalid_data
          end
        else
          :api_outage
        end
      end

      def classify_by_message(message)
        return :internal if message.blank?

        case message
        when /timed? ?out|ETIMEDOUT/i then :timeout
        when /rate.?limit|429|too many/i then :rate_limit
        when /ECONNREFUSED|ECONNRESET|EPIPE|EHOSTUNREACH|network/i then :api_outage
        else :internal
        end
      end

      def policy_error?(error)
        return false unless error.respond_to?(:failure) && error.failure.respond_to?(:errors)

        error.failure.errors.any? { |e|
          code = begin
            e.error_code.to_h
          rescue
            {}
          end
          code.values.any? { |v| v == :POLICY_FINDING }
        }
      rescue
        false
      end

      def auth_error?(error)
        return false unless error.respond_to?(:failure) && error.failure.respond_to?(:errors)

        error.failure.errors.any? { |e|
          code = begin
            e.error_code.to_h
          rescue
            {}
          end
          code.keys.any? { |k| k == :authorization_error }
        }
      rescue
        false
      end
    end
  end
end
