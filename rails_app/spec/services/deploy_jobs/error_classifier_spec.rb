require "rails_helper"

RSpec.describe DeployJobs::ErrorClassifier do
  describe ".classify" do
    context "with ApplicationClient errors" do
      it "classifies RateLimit as :rate_limit" do
        error = ApplicationClient::RateLimit.new("429 Too Many Requests")
        expect(described_class.classify(error)).to eq(:rate_limit)
      end

      it "classifies NotFound as :not_found" do
        error = ApplicationClient::NotFound.new("404 Not Found")
        expect(described_class.classify(error)).to eq(:not_found)
      end

      it "classifies Unauthorized as :auth_failure" do
        error = ApplicationClient::Unauthorized.new("401 Unauthorized")
        expect(described_class.classify(error)).to eq(:auth_failure)
      end

      it "classifies Forbidden as :auth_failure" do
        error = ApplicationClient::Forbidden.new("403 Forbidden")
        expect(described_class.classify(error)).to eq(:auth_failure)
      end

      it "classifies InternalError as :api_outage" do
        error = ApplicationClient::InternalError.new("500 Internal Server Error")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies generic Error as :api_outage" do
        error = ApplicationClient::Error.new("502 Bad Gateway")
        expect(described_class.classify(error)).to eq(:api_outage)
      end
    end

    context "with ActiveRecord errors" do
      it "classifies RecordNotFound as :not_found" do
        error = ActiveRecord::RecordNotFound.new("Couldn't find Campaign with id=999")
        expect(described_class.classify(error)).to eq(:not_found)
      end
    end

    context "with Lockable errors" do
      it "classifies LockNotAcquiredError as :api_outage (transient)" do
        error = Lockable::LockNotAcquiredError.new("Could not acquire lock")
        expect(described_class.classify(error)).to eq(:api_outage)
      end
    end

    context "with timeout errors" do
      it "classifies Timeout::Error" do
        error = Timeout::Error.new("execution expired")
        expect(described_class.classify(error)).to eq(:timeout)
      end

      it "classifies errors with 'timed out' in message" do
        error = StandardError.new("Connection timed out")
        expect(described_class.classify(error)).to eq(:timeout)
      end

      it "classifies ETIMEDOUT errors" do
        error = StandardError.new("connect ETIMEDOUT 1.2.3.4:443")
        expect(described_class.classify(error)).to eq(:timeout)
      end
    end

    context "with network errors" do
      it "classifies Errno::ECONNREFUSED" do
        error = Errno::ECONNREFUSED.new("Connection refused")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies Errno::ECONNRESET" do
        error = Errno::ECONNRESET.new("Connection reset by peer")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies Errno::EPIPE" do
        error = Errno::EPIPE.new("Broken pipe")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies Errno::EBADF" do
        error = Errno::EBADF.new("Bad file descriptor")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies Errno::EHOSTUNREACH" do
        error = Errno::EHOSTUNREACH.new("No route to host")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies Errno::ENETUNREACH" do
        error = Errno::ENETUNREACH.new("Network is unreachable")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies Errno::EINVAL" do
        error = Errno::EINVAL.new("Invalid argument")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies EOFError" do
        error = EOFError.new("end of file reached")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies IOError" do
        error = IOError.new("stream closed")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies Net::HTTPBadResponse" do
        error = Net::HTTPBadResponse.new("wrong status line")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies Net::HTTPHeaderSyntaxError" do
        error = Net::HTTPHeaderSyntaxError.new("bad header")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies Net::ProtocolError" do
        error = Net::ProtocolError.new("protocol error")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies OpenSSL::SSL::SSLError" do
        error = OpenSSL::SSL::SSLError.new("SSL_connect returned=1")
        expect(described_class.classify(error)).to eq(:api_outage)
      end
    end

    context "with data errors" do
      it "classifies ArgumentError as :invalid_data" do
        error = ArgumentError.new("wrong number of arguments")
        expect(described_class.classify(error)).to eq(:invalid_data)
      end

      it "classifies TypeError as :invalid_data" do
        error = TypeError.new("no implicit conversion of nil into String")
        expect(described_class.classify(error)).to eq(:invalid_data)
      end
    end

    context "with message-based fallback" do
      it "classifies rate limit messages" do
        error = StandardError.new("Rate limit exceeded: too many requests")
        expect(described_class.classify(error)).to eq(:rate_limit)
      end

      it "classifies 429 messages" do
        error = StandardError.new("HTTP 429 - Too Many Requests")
        expect(described_class.classify(error)).to eq(:rate_limit)
      end

      it "classifies network error messages" do
        error = StandardError.new("ECONNREFUSED: connection refused")
        expect(described_class.classify(error)).to eq(:api_outage)
      end

      it "classifies blank message as :internal" do
        error = StandardError.new("")
        expect(described_class.classify(error)).to eq(:internal)
      end

      it "classifies unknown errors as :internal" do
        error = StandardError.new("Something completely unexpected")
        expect(described_class.classify(error)).to eq(:internal)
      end
    end

    context "with generic StandardError/RuntimeError" do
      it "reports to Sentry for bare StandardError" do
        error = StandardError.new("vague error")
        expect(Sentry).to receive(:capture_message).with(
          /Generic StandardError reached ErrorClassifier/,
          hash_including(level: :warning)
        )
        described_class.classify(error)
      end

      it "reports to Sentry for bare RuntimeError" do
        error = RuntimeError.new("something broke")
        expect(Sentry).to receive(:capture_message).with(
          /Generic RuntimeError reached ErrorClassifier/,
          hash_including(level: :warning)
        )
        described_class.classify(error)
      end

      it "does not report subclasses of StandardError to Sentry" do
        error = ArgumentError.new("bad arg")
        expect(Sentry).not_to receive(:capture_message)
        described_class.classify(error)
      end
    end

    context "with Google Ads errors", if: defined?(Google::Ads::GoogleAds::Errors::GoogleAdsError) do
      let(:google_error) { Google::Ads::GoogleAds::Errors::GoogleAdsError.new("API error") }

      it "classifies terminal Google Ads errors as :invalid_data by default" do
        allow(GoogleAds::TerminalErrors).to receive(:terminal?).with(google_error).and_return(true)
        failure = double("failure", errors: [])
        allow(google_error).to receive(:failure).and_return(failure)
        expect(described_class.classify(google_error)).to eq(:invalid_data)
      end

      it "classifies non-terminal Google Ads errors as :api_outage" do
        allow(GoogleAds::TerminalErrors).to receive(:terminal?).with(google_error).and_return(false)
        expect(described_class.classify(google_error)).to eq(:api_outage)
      end
    end
  end
end
